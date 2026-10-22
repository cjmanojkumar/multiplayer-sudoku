const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// In-memory room store: roomCode -> room data
const rooms = {};

// Sudoku Generator & Solver Helpers
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
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        for (const num of nums) {
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

function generatePuzzle(difficulty = 35) { // 35 clues removed for a balanced multiplayer speed
  const board = Array.from({ length: 9 }, () => Array(9).fill(0));
  solveSudoku(board);
  const solution = board.map(row => [...row]);

  const puzzle = board.map(row => [...row]);
  let removed = 0;
  while (removed < difficulty) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== 0) {
      puzzle[r][c] = 0;
      removed++;
    }
  }
  return { puzzle, solution, totalBlanks: difficulty };
}

// Socket Connection Handling
io.on('connection', (socket) => {
  socket.on('createRoom', ({ username }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const { puzzle, solution, totalBlanks } = generatePuzzle(30);

    rooms[roomCode] = {
      players: [{ id: socket.id, name: username, score: 0 }],
      puzzle,
      solution,
      totalBlanks,
      started: false
    };

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode });
    socket.emit('playerListUpdate', rooms[roomCode].players);
  });

  socket.on('joinRoom', ({ roomCode, username }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) {
      socket.emit('errorMessage', 'Room not found!');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('errorMessage', 'Room is full! (Max 2 players)');
      return;
    }

    room.players.push({ id: socket.id, name: username, score: 0 });
    socket.join(code);

    socket.emit('joinedRoomSuccess', { roomCode: code });
    io.to(code).emit('playerListUpdate', room.players);

    // Auto-start match when 2 players join
    if (room.players.length === 2) {
      room.started = true;
      io.to(code).emit('startGame', {
        puzzle: room.puzzle,
        players: room.players,
        totalBlanks: room.totalBlanks
      });
    }
  });

  socket.on('submitMove', ({ roomCode, row, col, value }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room || !room.started) return;

    const isCorrect = room.solution[row][col] === parseInt(value, 10);
    const player = room.players.find(p => p.id === socket.id);

    if (isCorrect) {
      if (player) player.score += 1;

      // Broadcast progress update to both players
      io.to(code).emit('progressUpdate', {
        playerId: socket.id,
        score: player ? player.score : 0,
        totalBlanks: room.totalBlanks
      });

      // Confirm to current player that cell is correct
      socket.emit('moveResult', { row, col, value, correct: true });

      // Check win condition
      if (player && player.score >= room.totalBlanks) {
        io.to(code).emit('gameOver', { winner: player.name });
      }
    } else {
      socket.emit('moveResult', { row, col, value, correct: false });
    }
  });

  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const disconnectedPlayer = room.players[index];
        room.players.splice(index, 1);
        io.to(code).emit('playerListUpdate', room.players);
        io.to(code).emit('playerDisconnected', { name: disconnectedPlayer.name });
        if (room.players.length === 0) {
          delete rooms[code];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});