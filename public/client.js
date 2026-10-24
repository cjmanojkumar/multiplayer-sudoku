const socket = io();

let currentRoomCode = null;
let myId = null;
let isEliminated = false;
let selectedCell = null;
let activeSymbolSet = 'numbers';

// Audio & Animation Flags
let isSoundEnabled = true;
let isMusicEnabled = false;
let isEmojiEnabled = true;

// Symbol sets
const SYMBOL_SETS = {
  numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  roman: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'],
  emojis: ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍍', '🍒', '🥝'],
  shapes: ['★', '✦', '♠', '♥', '♦', '♣', '⬢', '▲', '◈']
};

function getSymbol(num) {
  if (num === 0) return '';
  const list = SYMBOL_SETS[activeSymbolSet] || SYMBOL_SETS.numbers;
  return list[num - 1] || num;
}

const completedRows = new Set();
const completedCols = new Set();
const completedBoxes = new Set();

// UI Elements
const scenicBg = document.getElementById('scenic-bg');
const bgSelect = document.getElementById('bg-select');
const themeSelect = document.getElementById('theme-select');
const fontSelect = document.getElementById('font-select');
const customColorPicker = document.getElementById('custom-color-picker');

const musicToggle = document.getElementById('music-toggle');
const soundToggle = document.getElementById('sound-toggle');
const emojiToggle = document.getElementById('emoji-toggle');

const settingsOpenBtn = document.getElementById('settings-open-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseX = document.getElementById('settings-close-x');
const settingsSaveBtn = document.getElementById('settings-save-btn');

const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const usernameInput = document.getElementById('username');
const symbolSetSelect = document.getElementById('symbol-set-select');
const difficultySelect = document.getElementById('difficulty');
const maxPlayersSelect = document.getElementById('max-players');
const botSpeedSelect = document.getElementById('bot-speed');
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
const symbolPad = document.getElementById('symbol-pad');
const eliminatedBanner = document.getElementById('eliminated-banner');

const colMaxPlayers = document.getElementById('col-max-players');
const colBotSpeed = document.getElementById('col-bot-speed');
const multiJoinContainer = document.getElementById('multi-join-container');

const winnerModal = document.getElementById('winner-modal');
const winnerReason = document.getElementById('winner-reason');
const leaderboardBody = document.getElementById('leaderboard-body');
const modalCloseX = document.getElementById('modal-close-x');

// Mode toggle handling (Multi vs Bot)
document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'bot') {
      colMaxPlayers.classList.add('hidden');
      colBotSpeed.classList.remove('hidden');
      multiJoinContainer.classList.add('hidden');
      createBtn.textContent = 'Start vs Bot 🤖';
    } else {
      colMaxPlayers.classList.remove('hidden');
      colBotSpeed.classList.add('hidden');
      multiJoinContainer.classList.remove('hidden');
      createBtn.textContent = 'Create Room';
    }
  });
});

// Settings Modal
settingsOpenBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
const closeSettings = () => settingsModal.classList.add('hidden');
settingsCloseX.addEventListener('click', closeSettings);
settingsSaveBtn.addEventListener('click', closeSettings);

bgSelect.addEventListener('change', (e) => scenicBg.className = `scenic-bg bg-${e.target.value}`);
themeSelect.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value);
  document.documentElement.style.removeProperty('--accent');
});
fontSelect.addEventListener('change', (e) => document.documentElement.setAttribute('data-font', e.target.value));
customColorPicker.addEventListener('input', (e) => document.documentElement.style.setProperty('--accent', e.target.value));

soundToggle.addEventListener('change', (e) => isSoundEnabled = e.target.checked);
emojiToggle.addEventListener('change', (e) => isEmojiEnabled = e.target.checked);

musicToggle.addEventListener('change', (e) => {
  isMusicEnabled = e.target.checked;
  if (isMusicEnabled) {
    startAmbientMusic();
  } else {
    stopAmbientMusic();
  }
});

modalCloseX.addEventListener('click', () => winnerModal.classList.add('hidden'));

// --- PROCEDURAL AMBIENT MUSIC ENGINE (Continuous Lo-Fi Chords) ---
let audioCtx = null;
let musicInterval = null;
let currentChordIndex = 0;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Gentle ambient chord progression (Cmaj7 -> Am7 -> Fmaj7 -> G7)
const ambientChords = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7
  [220.00, 261.63, 329.63, 392.00], // Am7
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [196.00, 246.94, 293.66, 349.23]  // G7
];

function playAmbientChord(freqs) {
  if (!isMusicEnabled) return;
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const duration = 3.6;

  freqs.forEach(freq => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Warm low-pass filter
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    // Gentle slow fade-in and fade-out
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.018, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  });
}

function startAmbientMusic() {
  getAudioContext();
  if (musicInterval) clearInterval(musicInterval);
  playAmbientChord(ambientChords[currentChordIndex]);
  musicInterval = setInterval(() => {
    if (!isMusicEnabled) return;
    currentChordIndex = (currentChordIndex + 1) % ambientChords.length;
    playAmbientChord(ambientChords[currentChordIndex]);
  }, 3400);
}

function stopAmbientMusic() {
  if (musicInterval) {
    clearInterval(musicInterval);
    musicInterval = null;
  }
}

// Sound effects
function playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
  if (!isSoundEnabled) return;
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
  } catch (e) {}
}

function playSuccessSound() {
  playTone(587.33, 'sine', 0.1, 0.08);
  setTimeout(() => playTone(880, 'sine', 0.15, 0.08), 80);
}

function playErrorSound() {
  playTone(150, 'sawtooth', 0.25, 0.12);
}

function playSectionCompleteSound() {
  playTone(523.25, 'triangle', 0.12, 0.1);
  setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.1), 100);
  setTimeout(() => playTone(783.99, 'triangle', 0.12, 0.1), 200);
  setTimeout(() => playTone(1046.50, 'triangle', 0.25, 0.12), 300);
}

function playVictoryFanfare() {
  [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
    setTimeout(() => playTone(f, 'triangle', 0.2, 0.12), i * 120);
  });
}

function spawnFloatingEmoji(cellElement, emojiList = ['✨', '🔥', '⭐', '🎯', '🚀']) {
  if (!isEmojiEnabled) return;
  const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
  const span = document.createElement('span');
  span.classList.add('floating-emoji');
  span.textContent = randomEmoji;

  const rect = cellElement.getBoundingClientRect();
  const boardRect = gridContainer.getBoundingClientRect();
  span.style.left = `${rect.left - boardRect.left + rect.width / 2}px`;
  span.style.top = `${rect.top - boardRect.top + rect.height / 2}px`;

  gridContainer.parentElement.appendChild(span);
  setTimeout(() => span.remove(), 1200);
}

socket.on('connect', () => { myId = socket.id; });

// Start / Create Match
createBtn.addEventListener('click', () => {
  getAudioContext();
  if (isMusicEnabled) startAmbientMusic();

  const username = usernameInput.value.trim() || 'Player 1';
  const difficulty = difficultySelect.value;
  const durationMinutes = parseInt(customDurationInput.value, 10) || 10;
  const symbolSet = symbolSetSelect.value;
  const selectedMode = document.querySelector('input[name="game-mode"]:checked').value;

  if (selectedMode === 'bot') {
    const botSpeed = botSpeedSelect.value;
    socket.emit('createSoloBotRoom', { username, difficulty, botSpeed, durationMinutes, symbolSet });
  } else {
    const maxPlayers = maxPlayersSelect.value;
    socket.emit('createRoom', { username, difficulty, maxPlayers, durationMinutes, symbolSet });
  }
});

joinBtn.addEventListener('click', () => {
  getAudioContext();
  if (isMusicEnabled) startAmbientMusic();

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

socket.on('roomCreated', ({ roomCode, maxPlayers, difficulty, durationMinutes, symbolSet }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Room: ${roomCode} | Mode: ${symbolSet.toUpperCase()} | Waiting (1/${maxPlayers})...`;
});

socket.on('joinedRoomSuccess', ({ roomCode }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Joined ${roomCode}! Waiting for match...`;
});

socket.on('playerListUpdate', (players) => {
  lobbyRoster.innerHTML = '<strong>Players Joined:</strong> ' + players.map(p => p.name).join(', ');
});

socket.on('errorMessage', (msg) => alert(msg));
socket.on('playerDisconnected', ({ name }) => alert(`${name} left the room.`));

// Start Game
socket.on('startGame', ({ puzzle, players, totalBlanks, duration, symbolSet, roomCode }) => {
  isEliminated = false;
  selectedCell = null;
  activeSymbolSet = symbolSet || 'numbers';
  currentRoomCode = roomCode || currentRoomCode;
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

  // Scoreboard
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
  renderSymbolPad();
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
        cell.textContent = getSymbol(val);
      } else {
        cell.addEventListener('click', () => {
          if (isEliminated || cell.classList.contains('correct')) return;
          if (selectedCell) selectedCell.classList.remove('selected');
          selectedCell = cell;
          cell.classList.add('selected');
        });
      }
      gridContainer.appendChild(cell);
    }
  }
}

function renderSymbolPad() {
  symbolPad.innerHTML = '';
  const symbols = SYMBOL_SETS[activeSymbolSet] || SYMBOL_SETS.numbers;

  symbols.forEach((symbol, index) => {
    const val = index + 1;
    const btn = document.createElement('button');
    btn.classList.add('symbol-btn');
    btn.textContent = symbol;

    btn.addEventListener('click', () => {
      if (isEliminated || !selectedCell) return;
      makeMove(parseInt(selectedCell.dataset.row, 10), parseInt(selectedCell.dataset.col, 10), val);
    });

    symbolPad.appendChild(btn);
  });
}

window.addEventListener('keydown', (e) => {
  if (isEliminated || !selectedCell) return;
  const key = e.key.toUpperCase();

  if (/^[1-9]$/.test(key)) {
    makeMove(parseInt(selectedCell.dataset.row, 10), parseInt(selectedCell.dataset.col, 10), parseInt(key, 10));
  } else if (/^[A-I]$/.test(key)) {
    const val = key.charCodeAt(0) - 64;
    makeMove(parseInt(selectedCell.dataset.row, 10), parseInt(selectedCell.dataset.col, 10), val);
  }
});

function makeMove(row, col, value) {
  socket.emit('submitMove', {
    roomCode: currentRoomCode,
    row,
    col,
    value
  });
}

socket.on('moveResult', ({ row, col, value, correct, mistakes, eliminated }) => {
  const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  if (!cell) return;

  if (correct) {
    playSuccessSound();
    cell.classList.remove('wrong', 'selected');
    cell.classList.add('correct', 'user-filled');
    cell.textContent = getSymbol(value);
    selectedCell = null;

    checkCompletions();
  } else {
    playErrorSound();
    cell.classList.add('wrong');
    cell.textContent = getSymbol(value);
    updateLivesDisplay(mistakes);

    if (eliminated) {
      triggerPlayerEliminated('❌ You were eliminated (3 mistakes)!');
    }

    setTimeout(() => {
      cell.classList.remove('wrong');
      cell.textContent = '';
    }, 500);
  }
});

function checkCompletions() {
  let anyCompleted = false;

  for (let r = 0; r < 9; r++) {
    if (completedRows.has(r)) continue;
    let full = true;
    const cells = [];
    for (let c = 0; c < 9; c++) {
      const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (!isCellSolved(cell)) { full = false; break; }
      cells.push(cell);
    }
    if (full) {
      completedRows.add(r);
      animateCompletedSection(cells, ['🔥', '⚡', '💯']);
      anyCompleted = true;
    }
  }

  for (let c = 0; c < 9; c++) {
    if (completedCols.has(c)) continue;
    let full = true;
    const cells = [];
    for (let r = 0; r < 9; r++) {
      const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
      if (!isCellSolved(cell)) { full = false; break; }
      cells.push(cell);
    }
    if (full) {
      completedCols.add(c);
      animateCompletedSection(cells, ['🚀', '✨', '🎯']);
      anyCompleted = true;
    }
  }

  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const boxKey = `${br}-${bc}`;
      if (completedBoxes.has(boxKey)) continue;

      let full = true;
      const cells = [];
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
          if (!isCellSolved(cell)) { full = false; break; }
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

  if (anyCompleted) playSectionCompleteSound();
}

function isCellSolved(cell) {
  if (!cell) return false;
  return cell.classList.contains('prefilled') || cell.classList.contains('correct');
}

function animateCompletedSection(cells, emojiSet) {
  cells.forEach((cell, idx) => {
    setTimeout(() => {
      cell.classList.add('completed-flash');
      if (idx === 4) spawnFloatingEmoji(cell, emojiSet);
      setTimeout(() => cell.classList.remove('completed-flash'), 1000);
    }, idx * 35);
  });
}

function triggerPlayerEliminated(message) {
  isEliminated = true;
  quitBtn.disabled = true;
  eliminatedBanner.textContent = message;
  eliminatedBanner.classList.remove('hidden');
  if (selectedCell) selectedCell.classList.remove('selected');
}

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

    if (eliminated && card) card.classList.add('eliminated');
  }
});

socket.on('gameOver', ({ reason, leaderboard }) => {
  gameView.classList.add('game-locked');
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