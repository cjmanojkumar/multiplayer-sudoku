const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'database.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      adminSecretKey: '22Harinishree C J Pallavishree15'
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    return { users: [], adminSecretKey: 'SUDOKU_SUPER_ADMIN_2026' };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

loadDB();

// Track online players
const onlineUsers = new Map(); // username -> socketId

// --- AUTHENTICATION API ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim().length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username (min 3 chars) and password (min 4 chars) required.' });
  }

  const cleanUser = username.trim();
  const db = loadDB();

  if (db.users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
    return res.status(400).json({ error: 'Username already taken.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: 'user_' + Date.now(),
    username: cleanUser,
    passwordHash,
    role: cleanUser.toLowerCase() === 'admin' ? 'admin' : 'player',
    matchesPlayed: 0,
    matchesWon: 0,
    totalScore: 0,
    friends: [], // array of usernames
    friendRequests: [], // array of incoming usernames
    history: [],
    registeredAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDB(db);

  res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      matchesPlayed: 0,
      matchesWon: 0,
      totalScore: 0,
      friends: [],
      friendRequests: [],
      history: []
    }
  });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(400).json({ error: 'Invalid username or password.' });
  }

  user.lastLoginAt = new Date().toISOString();
  saveDB(db);

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      matchesPlayed: user.matchesPlayed || 0,
      matchesWon: user.matchesWon || 0,
      totalScore: user.totalScore || 0,
      friends: user.friends || [],
      friendRequests: user.friendRequests || [],
      history: user.history || []
    }
  });
});

// --- PROFILE & STATS API ---
app.get('/api/user/profile/:username', (req, res) => {
  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'Player profile not found.' });

  const winRate = user.matchesPlayed > 0 ? Math.round((user.matchesWon / user.matchesPlayed) * 100) : 0;
  
  res.json({
    success: true,
    profile: {
      username: user.username,
      role: user.role,
      matchesPlayed: user.matchesPlayed || 0,
      matchesWon: user.matchesWon || 0,
      winRate: `${winRate}%`,
      totalScore: user.totalScore || 0,
      registeredAt: user.registeredAt,
      lastLoginAt: user.lastLoginAt,
      friendsCount: (user.friends || []).length
    }
  });
});

// --- FRIENDS SYSTEM API ---
app.post('/api/friends/send-request', (req, res) => {
  const { fromUser, targetUser } = req.body;
  if (!fromUser || !targetUser || fromUser.toLowerCase() === targetUser.toLowerCase()) {
    return res.status(400).json({ error: 'Invalid friend request.' });
  }

  const db = loadDB();
  const target = db.users.find(u => u.username.toLowerCase() === targetUser.trim().toLowerCase());
  const sender = db.users.find(u => u.username.toLowerCase() === fromUser.trim().toLowerCase());

  if (!target || !sender) return res.status(404).json({ error: 'User does not exist.' });

  if (!target.friendRequests) target.friendRequests = [];
  if (!target.friends) target.friends = [];
  if (!sender.friends) sender.friends = [];

  if (target.friends.includes(sender.username)) {
    return res.status(400).json({ error: 'You are already friends with this player.' });
  }

  if (target.friendRequests.includes(sender.username)) {
    return res.status(400).json({ error: 'Friend request already pending.' });
  }

  target.friendRequests.push(sender.username);
  saveDB(db);

  // Notify target user if currently online
  const targetSocketId = onlineUsers.get(target.username.toLowerCase());
  if (targetSocketId) {
    io.to(targetSocketId).emit('friendRequestReceived', { from: sender.username });
  }

  res.json({ success: true, message: `Friend request sent to ${target.username}!` });
});

app.post('/api/friends/respond-request', (req, res) => {
  const { username, fromUser, action } = req.body; // action: 'accept' | 'decline'
  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  const requester = db.users.find(u => u.username.toLowerCase() === fromUser.trim().toLowerCase());

  if (!user || !requester) return res.status(404).json({ error: 'Player not found.' });

  user.friendRequests = (user.friendRequests || []).filter(u => u.toLowerCase() !== fromUser.toLowerCase());

  if (action === 'accept') {
    if (!user.friends) user.friends = [];
    if (!requester.friends) requester.friends = [];

    if (!user.friends.includes(requester.username)) user.friends.push(requester.username);
    if (!requester.friends.includes(user.username)) requester.friends.push(user.username);
  }

  saveDB(db);
  res.json({ success: true, friends: user.friends, friendRequests: user.friendRequests });
});

app.get('/api/friends/list/:username', (req, res) => {
  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const friendsList = (user.friends || []).map(friendName => ({
    username: friendName,
    online: onlineUsers.has(friendName.toLowerCase())
  }));

  res.json({
    success: true,
    friends: friendsList,
    requests: user.friendRequests || []
  });
});

app.get('/api/user/history/:username', (req, res) => {
  const db = loadDB();
  const user = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, history: user.history || [] });
});

app.post('/api/admin/users', (req, res) => {
  const { adminKey } = req.body;
  const db = loadDB();

  if (adminKey !== db.adminSecretKey) {
    return res.status(403).json({ error: 'Access denied: Invalid Admin Key.' });
  }

  const safeUsers = db.users.map(({ passwordHash, ...rest }) => rest);
  res.json({ success: true, users: safeUsers });
});

function recordMatchStats(leaderboard, outcome, room) {
  const db = loadDB();
  leaderboard.forEach((p, idx) => {
    const user = db.users.find(u => u.username.toLowerCase() === p.name.toLowerCase());
    if (user) {
      user.matchesPlayed = (user.matchesPlayed || 0) + 1;
      user.totalScore = (user.totalScore || 0) + p.score;
      const won = idx === 0 && outcome === 'win' && !p.eliminated;
      if (won) user.matchesWon = (user.matchesWon || 0) + 1;

      if (!user.history) user.history = [];
      user.history.unshift({
        date: new Date().toISOString(),
        outcome: won ? 'Won' : p.eliminated ? 'Eliminated' : outcome === 'draw' ? 'Draw' : 'Finished',
        score: p.score,
        totalBlanks: room.totalBlanks,
        mistakes: p.mistakes,
        difficultyLevel: room.difficultyLevel || 4,
        mode: room.isBotGame ? 'Solo vs Bot' : 'Multiplayer'
      });

      if (user.history.length > 30) user.history.pop();
    }
  });
  saveDB(db);
}

// --- 7-TIER BLANKS GENERATOR ---
function getBlanksForLevel(level) {
  const scale = { 1: 15, 2: 22, 3: 30, 4: 38, 5: 45, 6: 50, 7: 55 };
  return scale[level] || 38;
}

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

function generatePuzzle(level = 4) {
  const blanks = getBlanksForLevel(parseInt(level, 10) || 4);
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

const rooms = {};

function getLeaderboard(room) {
  return [...room.players].sort((a, b) => {
    if (!a.eliminated && b.eliminated) return -1;
    if (a.eliminated && !b.eliminated) return 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.mistakes - b.mistakes;
  });
}

function terminateMatch(code, reason, matchOutcome = 'draw') {
  const room = rooms[code];
  if (!room || !room.started) return;
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.botInterval) clearInterval(room.botInterval);
  room.started = false;

  const leaderboard = getLeaderboard(room);
  recordMatchStats(leaderboard, matchOutcome, room);

  io.to(code).emit('gameOver', { reason, leaderboard, outcome: matchOutcome });
}

io.on('connection', (socket) => {

  // --- IN-GAME LIVE CHAT ---
  socket.on('sendChatMessage', ({ roomCode, text }) => {
    if (!roomCode || !text || !text.trim()) return;
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const senderName = player ? player.name : 'Player';

    io.to(code).emit('newChatMessage', {
      sender: senderName,
      senderId: socket.id,
      text: text.trim().substring(0, 150),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });
  
  // Track online status for logged players
  socket.on('registerOnlineUser', ({ username }) => {
    if (username) {
      onlineUsers.set(username.toLowerCase(), socket.id);
      socket.broadcast.emit('friendStatusChanged', { username, online: true });
    }
  });

  socket.on('createRoom', ({ username, difficultyLevel, maxPlayers, durationMinutes, symbolSet }) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const lvl = parseInt(difficultyLevel, 10) || 4;
    const { puzzle, solution, totalBlanks } = generatePuzzle(lvl);

    const validMinutes = Math.max(1, Math.min(60, parseInt(durationMinutes, 10) || 10));
    const totalSeconds = validMinutes * 60;

    rooms[roomCode] = {
      isBotGame: false,
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
      difficultyLevel: lvl,
      symbolSet: symbolSet || 'numbers',
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
      difficultyLevel: lvl,
      durationMinutes: validMinutes,
      symbolSet: rooms[roomCode].symbolSet
    });
    io.to(roomCode).emit('playerListUpdate', rooms[roomCode].players);
  });

  socket.on('createSoloBotRoom', ({ username, difficultyLevel, botSpeed, durationMinutes, symbolSet }) => {
    const roomCode = 'BOT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const lvl = parseInt(difficultyLevel, 10) || 4;
    const { puzzle, solution, totalBlanks } = generatePuzzle(lvl);

    const validMinutes = Math.max(1, Math.min(60, parseInt(durationMinutes, 10) || 10));
    const totalSeconds = validMinutes * 60;

    const botPlayer = { id: 'bot_ai', name: '🤖 AI Bot', score: 0, mistakes: 0, eliminated: false };
    const humanPlayer = { id: socket.id, name: username || 'Player 1', score: 0, mistakes: 0, eliminated: false };

    rooms[roomCode] = {
      isBotGame: true,
      botSpeed: botSpeed || 'medium',
      players: [humanPlayer, botPlayer],
      puzzle,
      solution,
      totalBlanks,
      difficultyLevel: lvl,
      symbolSet: symbolSet || 'numbers',
      maxPlayers: 2,
      duration: totalSeconds,
      timeLeft: totalSeconds,
      timerInterval: null,
      botInterval: null,
      started: true
    };

    socket.join(roomCode);
    socket.emit('startGame', {
      puzzle,
      players: rooms[roomCode].players,
      totalBlanks,
      duration: totalSeconds,
      symbolSet: rooms[roomCode].symbolSet,
      roomCode
    });

    rooms[roomCode].timerInterval = setInterval(() => {
      rooms[roomCode].timeLeft -= 1;
      io.to(roomCode).emit('timerTick', { timeLeft: rooms[roomCode].timeLeft });
      if (rooms[roomCode].timeLeft <= 0) {
        terminateMatch(roomCode, '⏰ Time ran out!', 'draw');
      }
    }, 1000);

    const speedIntervals = { slow: 7000, medium: 4500, fast: 2600 };
    const baseInterval = speedIntervals[botSpeed] || 4500;

    rooms[roomCode].botInterval = setInterval(() => {
      const room = rooms[roomCode];
      if (!room || !room.started) return;

      const bot = room.players.find(p => p.id === 'bot_ai');
      if (!bot || bot.eliminated) return;

      if (Math.random() < 0.08) {
        bot.mistakes += 1;
        if (bot.mistakes >= 3) {
          bot.eliminated = true;
          io.to(roomCode).emit('progressUpdate', {
            playerId: bot.id,
            score: bot.score,
            mistakes: bot.mistakes,
            eliminated: true,
            totalBlanks: room.totalBlanks
          });
          terminateMatch(roomCode, '🤖 AI Bot struck out! You win!', 'win');
          return;
        }
      } else {
        bot.score += 1;
      }

      io.to(roomCode).emit('progressUpdate', {
        playerId: bot.id,
        score: bot.score,
        mistakes: bot.mistakes,
        eliminated: bot.eliminated,
        totalBlanks: room.totalBlanks
      });

      if (bot.score >= room.totalBlanks) {
        terminateMatch(roomCode, '🤖 AI Bot finished the board first!', 'loss');
      }
    }, baseInterval);
  });

  socket.on('joinRoom', ({ roomCode, username }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];

    if (!room) return socket.emit('errorMessage', 'Room code not found.');
    if (room.started) return socket.emit('errorMessage', 'Match is already in progress.');
    if (room.players.length >= room.maxPlayers) return socket.emit('errorMessage', `Room is full.`);

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
      room.started = true;
      io.to(code).emit('startGame', {
        puzzle: room.puzzle,
        players: room.players,
        totalBlanks: room.totalBlanks,
        duration: room.duration,
        symbolSet: room.symbolSet,
        roomCode: code
      });

      room.timerInterval = setInterval(() => {
        room.timeLeft -= 1;
        io.to(code).emit('timerTick', { timeLeft: room.timeLeft });
        if (room.timeLeft <= 0) terminateMatch(code, '⏰ Time ran out!', 'draw');
      }, 1000);
    }
  });

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

      socket.emit('moveResult', { row, col, value, correct: true });

      if (player.score >= room.totalBlanks) {
        terminateMatch(code, `🎉 ${player.name} completed the board!`, 'win');
      }
    } else {
      player.mistakes += 1;
      if (player.mistakes >= 3) player.eliminated = true;

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
        value,
        correct: false, 
        mistakes: player.mistakes,
        eliminated: player.eliminated
      });

      const alivePlayers = room.players.filter(p => !p.eliminated);
      if (alivePlayers.length === 0) {
        terminateMatch(code, '💀 All players lost their lives!', 'loss');
      } else if (room.players.length > 1 && alivePlayers.length === 1) {
        terminateMatch(code, `👑 ${alivePlayers[0].name} wins!`, 'win');
      }
    }
  });

  socket.on('quitGame', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room || !room.started) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    player.eliminated = true;
    io.to(code).emit('progressUpdate', {
      playerId: socket.id,
      score: player.score,
      mistakes: player.mistakes,
      eliminated: true,
      totalBlanks: room.totalBlanks
    });

    const alivePlayers = room.players.filter(p => !p.eliminated);
    if (alivePlayers.length === 0) {
      terminateMatch(code, `${player.name} resigned.`, 'resign');
    } else if (room.players.length > 1 && alivePlayers.length === 1) {
      terminateMatch(code, `🏳️ ${player.name} resigned. ${alivePlayers[0].name} wins!`, 'win');
    }
  });

  socket.on('disconnect', () => {
    // Clean up online map
    for (const [user, sId] of onlineUsers.entries()) {
      if (sId === socket.id) {
        onlineUsers.delete(user);
        socket.broadcast.emit('friendStatusChanged', { username: user, online: false });
        break;
      }
    }

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
          if (alivePlayers.length === 0 || room.players.length === 0) {
            terminateMatch(code, 'Match ended.', 'resign');
          } else if (alivePlayers.length === 1) {
            terminateMatch(code, `${alivePlayers[0].name} won!`, 'win');
          }
        }

        if (room.players.length === 0 || (room.isBotGame && room.players.length <= 1)) {
          if (room.timerInterval) clearInterval(room.timerInterval);
          if (room.botInterval) clearInterval(room.botInterval);
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