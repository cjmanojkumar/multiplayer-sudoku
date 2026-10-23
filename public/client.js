const socket = io();

let currentRoomCode = null;
let myId = null;
let isEliminated = false;

// Tracking already-completed sections so sound/animations trigger only once
const completedRows = new Set();
const completedCols = new Set();
const completedBoxes = new Set();

// UI Elements
const themeSelect = document.getElementById('theme-select');
const customColorPicker = document.getElementById('custom-color-picker');
const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const usernameInput = document.getElementById('username');
const difficultySelect = document.getElementById('difficulty');
const maxPlayersSelect = document.getElementById('max-players');
const customDurationInput = document.getElementById('custom-duration');
const roomCodeInput = document.getElementById('room-code-input');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const quitBtn = document.getElementById('quit-btn');
const roomStatus = document.getElementById('room-status');
const lobbyRoster = document.getElementById('lobby-roster');
const currentRoomSpan = document.getElementById('current-room');
const timerDisplay = document.getElementById('timer-display');
const myLivesDisplay = document.getElementById('my-lives');
const scoreboard = document.getElementById('scoreboard');
const gridContainer = document.getElementById('sudoku-grid');
const eliminatedBanner = document.getElementById('eliminated-banner');

// Modal Elements
const winnerModal = document.getElementById('winner-modal');
const winnerReason = document.getElementById('winner-reason');
const leaderboardBody = document.getElementById('leaderboard-body');
const modalCloseX = document.getElementById('modal-close-x');

// --- WEB AUDIO API SYNTHESIZER ---
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Ignore audio restrictions
  }
}

// Single correct cell sound: high melodic chime
function playSuccessSound() {
  playTone(587.33, 'sine', 0.1, 0.08); // D5
  setTimeout(() => playTone(880, 'sine', 0.15, 0.08), 80); // A5
}

// Wrong move / strike sound: low buzz
function playErrorSound() {
  playTone(150, 'sawtooth', 0.25, 0.12);
}

// Row / Col / 3x3 complete fanfare: 3-note ascending arpeggio
function playSectionCompleteSound() {
  playTone(523.25, 'triangle', 0.12, 0.1); // C5
  setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.1), 100); // E5
  setTimeout(() => playTone(783.99, 'triangle', 0.12, 0.1), 200); // G5
  setTimeout(() => playTone(1046.50, 'triangle', 0.25, 0.12), 300); // C6
}

// Match Victory sound
function playVictoryFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 'triangle', 0.2, 0.12), i * 120);
  });
}

// --- EMOJI BURST EFFECT ---
function spawnFloatingEmoji(cellElement, emojiList = ['✨', '🔥', '⭐', '🎯', '🚀']) {
  const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
  const span = document.createElement('span');
  span.classList.add('floating-emoji');
  span.textContent = randomEmoji;

  const rect = cellElement.getBoundingClientRect();
  const boardRect = gridContainer.getBoundingClientRect();

  // Position relative to Sudoku grid container
  span.style.left = `${rect.left - boardRect.left + rect.width / 2}px`;
  span.style.top = `${rect.top - boardRect.top + rect.height / 2}px`;

  gridContainer.parentElement.appendChild(span);
  setTimeout(() => span.remove(), 1200);
}

// --- COMPLETION CHECKERS FOR ROWS, COLS, 3X3 ---
function checkCompletions() {
  let anyCompleted = false;

  // 1. Check all 9 Rows
  for (let r = 0; r < 9; r++) {
    if (completedRows.has(r)) continue;
    let full = true;
    const cells = [];
    for (let c = 0; c < 9; c++) {
      const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (!isCellSolved(cell)) {
        full = false;
        break;
      }
      cells.push(cell);
    }
    if (full) {
      completedRows.add(r);
      animateCompletedSection(cells, ['🔥', '⚡', '💯']);
      anyCompleted = true;
    }
  }

  // 2. Check all 9 Columns
  for (let c = 0; c < 9; c++) {
    if (completedCols.has(c)) continue;
    let full = true;
    const cells = [];
    for (let r = 0; r < 9; r++) {
      const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (!isCellSolved(cell)) {
        full = false;
        break;
      }
      cells.push(cell);
    }
    if (full) {
      completedCols.add(c);
      animateCompletedSection(cells, ['🚀', '✨', '🎯']);
      anyCompleted = true;
    }
  }

  // 3. Check all 9 3x3 Boxes
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const boxKey = `${br}-${bc}`;
      if (completedBoxes.has(boxKey)) continue;

      let full = true;
      const cells = [];
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
          if (!isCellSolved(cell)) {
            full = false;
            break;
          }
          cells.push(cell);
        }
      }
      if (full) {
        completedBoxes.add(boxKey);
        animateCompletedSection(cells, ['⭐', '👑', '🌟']);
        anyCompleted = true;
      }
    }
  }

  if (anyCompleted) {
    playSectionCompleteSound();
  }
}

function isCellSolved(cell) {
  if (!cell) return false;
  if (cell.classList.contains('prefilled')) return true;
  const input = cell.querySelector('input');
  return input && input.classList.contains('correct');
}

function animateCompletedSection(cells, emojiSet) {
  cells.forEach((cell, idx) => {
    setTimeout(() => {
      cell.classList.add('completed-flash');
      if (idx === 4) { // Center cell releases emoji
        spawnFloatingEmoji(cell, emojiSet);
      }
      setTimeout(() => cell.classList.remove('completed-flash'), 1000);
    }, idx * 35); // Wave effect across the section
  });
}

// Modal handling
modalCloseX.addEventListener('click', () => {
  winnerModal.classList.add('hidden');
});

// Theme & Color Handlers
themeSelect.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value);
  document.documentElement.style.removeProperty('--accent');
});

customColorPicker.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--accent', e.target.value);
});

socket.on('connect', () => {
  myId = socket.id;
});

// Setup handlers
createBtn.addEventListener('click', () => {
  getAudioContext(); // Initialize audio context on user gesture
  const username = usernameInput.value.trim() || 'Player 1';
  const difficulty = difficultySelect.value;
  const maxPlayers = maxPlayersSelect.value;
  const durationMinutes = parseInt(customDurationInput.value, 10) || 10;

  socket.emit('createRoom', { username, difficulty, maxPlayers, durationMinutes });
});

joinBtn.addEventListener('click', () => {
  getAudioContext();
  const username = usernameInput.value.trim() || 'Player';
  const roomCode = roomCodeInput.value.trim();
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  socket.emit('joinRoom', { roomCode, username });
});

quitBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to resign from the match?')) {
    socket.emit('quitGame', { roomCode: currentRoomCode });
    triggerPlayerEliminated('🏳️ You resigned from the match.');
  }
});

socket.on('roomCreated', ({ roomCode, maxPlayers, difficulty, durationMinutes }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Room: ${roomCode} | ${difficulty.toUpperCase()} | ${durationMinutes} mins | Waiting (1/${maxPlayers})...`;
});

socket.on('joinedRoomSuccess', ({ roomCode }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Joined ${roomCode}! Waiting for players...`;
});

socket.on('playerListUpdate', (players) => {
  lobbyRoster.innerHTML = '<strong>Players Joined:</strong> ' + players.map(p => p.name).join(', ');
});

socket.on('errorMessage', (msg) => alert(msg));
socket.on('playerDisconnected', ({ name }) => alert(`${name} left the room.`));

// Start Game
socket.on('startGame', ({ puzzle, players, totalBlanks, duration }) => {
  isEliminated = false;
  quitBtn.disabled = false;
  completedRows.clear();
  completedCols.clear();
  completedBoxes.clear();

  lobbyView.classList.add('hidden');
  gameView.classList.remove('hidden', 'game-locked');
  eliminatedBanner.classList.add('hidden');
  winnerModal.classList.add('hidden');
  currentRoomSpan.textContent = currentRoomCode;

  updateLivesDisplay(0);
  updateTimerDisplay(duration);

  scoreboard.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.classList.add('player-card');
    card.id = `card-${p.id}`;
    card.innerHTML = `
      <span class="player-name">${p.name}</span>
      <div class="progress-bar"><div class="progress-fill" id="bar-${p.id}"></div></div>
      <div class="score-text">
        <span id="score-${p.id}">0 / ${totalBlanks}</span>
        <span id="mistakes-${p.id}">❤️ 3</span>
      </div>
    `;
    scoreboard.appendChild(card);
  });

  renderBoard(puzzle);
});

function updateLivesDisplay(mistakes) {
  const livesLeft = Math.max(0, 3 - mistakes);
  myLivesDisplay.textContent = 'Lives: ' + '❤️'.repeat(livesLeft) + '🖤'.repeat(3 - livesLeft);
}

socket.on('timerTick', ({ timeLeft }) => updateTimerDisplay(timeLeft));

function updateTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function renderBoard(puzzle) {
  gridContainer.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = puzzle[r][c];
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (val !== 0) {
        cell.classList.add('prefilled');
        cell.textContent = val;
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.dataset.row = r;
        input.dataset.col = c;

        input.addEventListener('input', (e) => {
          if (isEliminated) return;
          const typed = e.target.value;
          if (!/^[1-9]$/.test(typed)) {
            e.target.value = '';
            return;
          }
          socket.emit('submitMove', {
            roomCode: currentRoomCode,
            row: parseInt(e.target.dataset.row, 10),
            col: parseInt(e.target.dataset.col, 10),
            value: typed
          });
        });

        cell.appendChild(input);
      }
      gridContainer.appendChild(cell);
    }
  }
}

function triggerPlayerEliminated(message) {
  isEliminated = true;
  quitBtn.disabled = true;
  eliminatedBanner.textContent = message || '❌ You were eliminated (3 mistakes)!';
  eliminatedBanner.classList.remove('hidden');

  document.querySelectorAll('.cell input').forEach(input => {
    input.disabled = true;
  });
}

socket.on('moveResult', ({ row, col, correct, mistakes, eliminated }) => {
  const input = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
  if (!input) return;

  if (correct) {
    playSuccessSound();
    input.classList.remove('wrong');
    input.classList.add('correct');
    input.disabled = true;

    // Check if this move completed any horizontal, vertical, or 3x3 line
    checkCompletions();
  } else {
    playErrorSound();
    input.classList.add('wrong');
    updateLivesDisplay(mistakes);

    if (eliminated) {
      triggerPlayerEliminated('❌ You were eliminated (3 mistakes)!');
    }

    setTimeout(() => {
      input.classList.remove('wrong');
      input.value = '';
    }, 500);
  }
});

socket.on('progressUpdate', ({ playerId, score, mistakes, eliminated, totalBlanks }) => {
  const bar = document.getElementById(`bar-${playerId}`);
  const scoreSpan = document.getElementById(`score-${playerId}`);
  const mistakesSpan = document.getElementById(`mistakes-${playerId}`);
  const card = document.getElementById(`card-${playerId}`);

  if (bar && scoreSpan && mistakesSpan) {
    const pct = Math.min(100, Math.round((score / totalBlanks) * 100));
    bar.style.width = `${pct}%`;
    scoreSpan.textContent = `${score} / ${totalBlanks}`;

    const livesLeft = Math.max(0, 3 - mistakes);
    mistakesSpan.textContent = eliminated ? '💀 OUT' : `❤️ ${livesLeft}`;

    if (eliminated && card) {
      card.classList.add('eliminated');
    }
  }
});

socket.on('gameOver', ({ reason, leaderboard }) => {
  gameView.classList.add('game-locked');
  document.querySelectorAll('.cell input').forEach(input => {
    input.disabled = true;
  });
  quitBtn.disabled = true;

  playVictoryFanfare();

  winnerReason.textContent = reason;
  leaderboardBody.innerHTML = '';

  leaderboard.forEach((player, idx) => {
    const tr = document.createElement('tr');
    const medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `;
    tr.innerHTML = `
      <td>${medal}</td>
      <td>${player.name} ${player.id === myId ? '(You)' : ''}</td>
      <td>${player.score}</td>
      <td>${player.mistakes}/3</td>
      <td>${player.eliminated ? '❌ Eliminated' : '✅ Survived'}</td>
    `;
    leaderboardBody.appendChild(tr);
  });

  winnerModal.classList.remove('hidden');
});