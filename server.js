const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

// --- SUDOKU GENERATION & VALIDATION ---
function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[startRow + r][startCol + c] === num) return false;
    }
  }
  return true;
}

function solveSudoku(board) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        for (const num of numbers) {
          if (isValid(board, r, c, num)) {
            board[r][c] = num;
            if (solveSudoku(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generatePuzzle(difficulty = 'medium') {
  const blanksMap = { easy: 20, medium: 35, hard: 50 };
  const blanks = blanksMap[difficulty] || 35;

  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(board);
  const solution = board.map(row => [...row]);

  const puzzle = board.map(row => [...row]);
  let removed = 0;
  while (removed < blanks) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      removed++;
    }
  }
  return { puzzle, solution, totalBlanks: blanks };
}

// Generate sorted leaderboard
function getLeaderboard(room) {
  return [...room.players].sort((a, b) => {
    // Surviving players rank higher than eliminated
    if (!a.eliminated && b.eliminated) return -1;
    if (a.eliminated && !b.eliminated) return 1;
    // Higher score ranks higher
    if (b.score !== a.score) return b.score - a.score;
    // Fewer mistakes rank higher
    return a.mistakes - b.mistakes;
  });
}

// End match and broadcast leaderboard
function terminateMatch(code, reason) {
  const room = rooms[code];
  if (!room || !room.started) return;
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.started = false;

  const leaderboard = getLeaderboard(room);
  io.to(code).emit('gameOver', {
    reason,
    leaderboard
  });
}

// --- SOCKET CONNECTION HANDLING ---
io.on('connection', (socket) => {
  socket.on('createRoom', ({ username, difficulty, maxPlayers, durationMinutes }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const { puzzle, solution, totalBlanks } = generatePuzzle(difficulty);

    rooms[roomCode] = {
      players: [{
        id: socket.id,
        name: username || 'Player 1',
        score: 0,
        mistakes: 0,
        eliminated: false
      }],
      puzzle,
      solution,
      totalBlanks,
      maxPlayers: parseInt(maxPlayers, 10) || 2,
      duration: (parseInt(durationMinutes, 10) || 10) * 60,
      timeLeft: (parseInt(durationMinutes, 10) || 10) * 60,
      timerInterval: null,
      started: false
    };

    socket.join(roomCode);
    socket.emit('roomCreated', { 
      roomCode, 
      maxPlayers: rooms[roomCode].maxPlayers,
      difficulty 
    });
    io.to(roomCode).emit('playerListUpdate', rooms[roomCode].players);
  });

  socket.on('joinRoom', ({ roomCode, username }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) {
      socket.emit('errorMessage', 'Room code not found.');
      return;
    }
    if (room.started) {
      socket.emit('errorMessage', 'Match is already in progress.');
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      socket.emit('errorMessage', `Room is full (max ${room.maxPlayers} players).`);
      return;
    }

    room.players.push({ 
      id: socket.id, 
      name: username || `Player ${room.players.length + 1}`, 
      score: 0,
      mistakes: 0,
      eliminated: false
    });

    socket.join(code);
    socket.emit('joinedRoomSuccess', { roomCode: code });
    io.to(code).emit('playerListUpdate', room.players);

    if (room.players.length === room.maxPlayers) {
      startMatch(code);
    }
  });

  function startMatch(code) {
    const room = rooms[code];
    if (!room || room.started) return;
    room.started = true;

    io.to(code).emit('startGame', {
      puzzle: room.puzzle,
      players: room.players,
      totalBlanks: room.totalBlanks,
      duration: room.duration
    });

    room.timerInterval = setInterval(() => {
      room.timeLeft -= 1;
      io.to(code).emit('timerTick', { timeLeft: room.timeLeft });

      if (room.timeLeft <= 0) {
        terminateMatch(code, 'Time Expired!');
      }
    }, 1000);
  }

  socket.on('submitMove', ({ roomCode, row, col, value }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room || !room.started) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    const isCorrect = room.solution[row][col] === parseInt(value, 10);

    if (isCorrect) {
      player.score += 1;

      io.to(code).emit('progressUpdate', {
        playerId: socket.id,
        score: player.score,
        mistakes: player.mistakes,
        eliminated: player.eliminated,
        totalBlanks: room.totalBlanks
      });

      socket.emit('moveResult', { row, col, correct: true });

      // Win condition: completed puzzle
      if (player.score >= room.totalBlanks) {
        terminateMatch(code, `${player.name} completed the board!`);
      }
    } else {
      player.mistakes += 1;

      // Check if player struck out (3 mistakes)
      if (player.mistakes >= 3) {
        player.eliminated = true;
      }

      io.to(code).emit('progressUpdate', {
        playerId: socket.id,
        score: player.score,
        mistakes: player.mistakes,
        eliminated: player.eliminated,
        totalBlanks: room.totalBlanks
      });

      socket.emit('moveResult', { 
        row, 
        col, 
        correct: false, 
        mistakes: player.mistakes,
        eliminated: player.eliminated
      });

      // Check if all players are eliminated
      const alivePlayers = room.players.filter(p => !p.eliminated);
      if (alivePlayers.length === 0) {
        terminateMatch(code, 'All players were eliminated!');
      } else if (room.players.length > 1 && alivePlayers.length === 1) {
        // Last person standing wins
        terminateMatch(code, `${alivePlayers[0].name} is the last player standing!`);
      }
    }
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const leaving = room.players[index];
        room.players.splice(index, 1);
        io.to(code).emit('playerDisconnected', { name: leaving.name });
        io.to(code).emit('playerListUpdate', room.players);

        if (room.started) {
          const alivePlayers = room.players.filter(p => !p.eliminated);
          if (room.players.length === 0 || alivePlayers.length === 0) {
            terminateMatch(code, 'Match abandoned.');
          } else if (alivePlayers.length === 1) {
            terminateMatch(code, `${alivePlayers[0].name} won by default!`);
          }
        }

        if (room.players.length === 0) {
          if (room.timerInterval) clearInterval(room.timerInterval);
          delete rooms[code];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});