const socket = io();

let currentRoomCode = null;
let myId = null;

// UI Elements
const themeSelect = document.getElementById('theme-select');
const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const usernameInput = document.getElementById('username');
const difficultySelect = document.getElementById('difficulty');
const maxPlayersSelect = document.getElementById('max-players');
const durationSelect = document.getElementById('duration');
const roomCodeInput = document.getElementById('room-code-input');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomStatus = document.getElementById('room-status');
const lobbyRoster = document.getElementById('lobby-roster');
const currentRoomSpan = document.getElementById('current-room');
const timerDisplay = document.getElementById('timer-display');
const scoreboard = document.getElementById('scoreboard');
const gridContainer = document.getElementById('sudoku-grid');
const winnerModal = document.getElementById('winner-modal');
const winnerMessage = document.getElementById('winner-message');

// Theme Switcher
themeSelect.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value);
});

socket.on('connect', () => {
  myId = socket.id;
});

// Create & Join Actions
createBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim() || 'Player 1';
  const difficulty = difficultySelect.value;
  const maxPlayers = maxPlayersSelect.value;
  const durationMinutes = durationSelect.value;

  socket.emit('createRoom', { username, difficulty, maxPlayers, durationMinutes });
});

joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim() || 'Player';
  const roomCode = roomCodeInput.value.trim();
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  socket.emit('joinRoom', { roomCode, username });
});

socket.on('roomCreated', ({ roomCode, maxPlayers, difficulty }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Room: ${roomCode} | Mode: ${difficulty.toUpperCase()} | Waiting for players (1/${maxPlayers})...`;
});

socket.on('joinedRoomSuccess', ({ roomCode }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Joined room ${roomCode}! Waiting for match to fill...`;
});

socket.on('playerListUpdate', (players) => {
  lobbyRoster.innerHTML = '<strong>Players Joined:</strong> ' + players.map(p => p.name).join(', ');
});

socket.on('errorMessage', (msg) => alert(msg));
socket.on('playerDisconnected', ({ name }) => alert(`${name} left the room.`));

// Start Game
socket.on('startGame', ({ puzzle, players, totalBlanks, duration }) => {
  lobbyView.classList.add('hidden');
  gameView.classList.remove('hidden');
  currentRoomSpan.textContent = currentRoomCode;

  updateTimerDisplay(duration);

  // Setup dynamic scoreboard for up to 4 players
  scoreboard.innerHTML = '';
  players.forEach(p => {
    const card = document.createElement('div');
    card.classList.add('player-card');
    card.id = `card-${p.id}`;
    card.innerHTML = `
      <span class="player-name">${p.name}</span>
      <div class="progress-bar"><div class="progress-fill" id="bar-${p.id}"></div></div>
      <span class="score-text" id="score-${p.id}">0 / ${totalBlanks}</span>
    `;
    scoreboard.appendChild(card);
  });

  renderBoard(puzzle);
});

// Timer Updates
socket.on('timerTick', ({ timeLeft }) => {
  updateTimerDisplay(timeLeft);
});

function updateTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Sudoku Board Rendering
function renderBoard(puzzle) {
  gridContainer.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = puzzle[r][c];
      const cell = document.createElement('div');
      cell.classList.add('cell');

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

socket.on('moveResult', ({ row, col, correct }) => {
  const input = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
  if (!input) return;

  if (correct) {
    input.classList.remove('wrong');
    input.classList.add('correct');
    input.disabled = true;
  } else {
    input.classList.add('wrong');
    setTimeout(() => {
      input.classList.remove('wrong');
      input.value = '';
    }, 500);
  }
});

socket.on('progressUpdate', ({ playerId, score, totalBlanks }) => {
  const bar = document.getElementById(`bar-${playerId}`);
  const scoreSpan = document.getElementById(`score-${playerId}`);
  if (bar && scoreSpan) {
    const pct = Math.min(100, Math.round((score / totalBlanks) * 100));
    bar.style.width = `${pct}%`;
    scoreSpan.textContent = `${score} / ${totalBlanks}`;
  }
});

socket.on('gameOver', ({ winner }) => {
  winnerMessage.textContent = `🏆 ${winner} Won the Match!`;
  winnerModal.classList.remove('hidden');
});