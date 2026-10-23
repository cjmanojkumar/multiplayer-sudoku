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

// --- SOCKET CONNECTION HANDLING ---
io.on('connection', (socket) => {
  socket.on('createRoom', ({ username, difficulty, maxPlayers, durationMinutes }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const { puzzle, solution, totalBlanks } = generatePuzzle(difficulty);

    rooms[roomCode] = {
      players: [{ id: socket.id, name: username || 'Player 1', score: 0 }],
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
      score: 0 
    });
    socket.join(code);
    socket.emit('joinedRoomSuccess', { roomCode: code });
    io.to(code).emit('playerListUpdate', room.players);

    // Auto-start when all player slots are filled
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

    // Start server-authoritative countdown timer
    room.timerInterval = setInterval(() => {
      room.timeLeft -= 1;
      io.to(code).emit('timerTick', { timeLeft: room.timeLeft });

      if (room.timeLeft <= 0) {
        clearInterval(room.timerInterval);
        // Find player with highest score
        let topScore = -1;
        let winner = 'Nobody';
        room.players.forEach(p => {
          if (p.score > topScore) {
            topScore = p.score;
            winner = p.name;
          }
        });
        io.to(code).emit('gameOver', { 
          winner: `${winner} (Time Expired with ${topScore} solved)` 
        });
      }
    }, 1000);
  }

  socket.on('submitMove', ({ roomCode, row, col, value }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room || !room.started) return;

    const isCorrect = room.solution[row][col] === parseInt(value, 10);
    const player = room.players.find(p => p.id === socket.id);

    if (isCorrect) {
      if (player) player.score += 1;

      io.to(code).emit('progressUpdate', {
        playerId: socket.id,
        score: player ? player.score : 0,
        totalBlanks: room.totalBlanks
      });

      socket.emit('moveResult', { row, col, correct: true });

      if (player && player.score >= room.totalBlanks) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        io.to(code).emit('gameOver', { winner: player.name });
      }
    } else {
      socket.emit('moveResult', { row, col, correct: false });
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