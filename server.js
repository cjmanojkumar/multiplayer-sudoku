const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

// --- SUDOKU GENERATOR & SOLVER ---
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

function getLeaderboard(room) {
  return [...room.players].sort((a, b) => {
    // 1. Survived players rank higher than knocked out players
    if (!a.eliminated && b.eliminated) return -1;
    if (a.eliminated && !b.eliminated) return 1;
    // 2. Higher score ranks higher
    if (b.score !== a.score) return b.score - a.score;
    // 3. Fewer mistakes rank higher
    return a.mistakes - b.mistakes;
  });
}

function terminateMatch(code, reason) {
  const room = rooms[code];
  if (!room || !room.started) return;
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.started = false;

  const leaderboard = getLeaderboard(room);
  io.to(code).emit('gameOver', { reason, leaderboard });
}

// --- SOCKET CONNECTION HANDLING ---
io.on('connection', (socket) => {
  socket.on('createRoom', ({ username, difficulty, maxPlayers, durationMinutes }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const { puzzle, solution, totalBlanks } = generatePuzzle(difficulty);

    const validMinutes = Math.max(1, Math.min(60, parseInt(durationMinutes, 10) || 10));
    const totalSeconds = validMinutes * 60;

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
      duration: totalSeconds,
      timeLeft: totalSeconds,
      timerInterval: null,
      started: false
    };

    socket.join(roomCode);
    socket.emit('roomCreated', { 
      roomCode, 
      maxPlayers: rooms[roomCode].maxPlayers,
      difficulty,
      durationMinutes: validMinutes
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

    // Dedicated 1-second interval loop
    room.timerInterval = setInterval(() => {
      room.timeLeft -= 1;
      io.to(code).emit('timerTick', { timeLeft: room.timeLeft });

      // Automatically terminate when countdown hits 0
      if (room.timeLeft <= 0) {
        terminateMatch(code, '⏰ Time ran out!');
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

      // Full board solved
      if (player.score >= room.totalBlanks) {
        terminateMatch(code, `🎉 ${player.name} completed the board!`);
      }
    } else {
      player.mistakes += 1;

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

      // Check survivor conditions
      const alivePlayers = room.players.filter(p => !p.eliminated);
      if (alivePlayers.length === 0) {
        terminateMatch(code, '💀 All players lost their lives!');
      } else if (room.players.length > 1 && alive