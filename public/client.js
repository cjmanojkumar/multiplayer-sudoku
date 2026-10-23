const socket = io();

let currentRoomCode = null;
let myId = null;
let isEliminated = false;

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
const myLivesDisplay = document.getElementById('my-lives');
const scoreboard = document.getElementById('scoreboard');
const gridContainer = document.getElementById('sudoku-grid');
const eliminatedBanner = document.getElementById('eliminated-banner');
const winnerModal = document.getElementById('winner-modal');
const winnerReason = document.getElementById('winner-reason');
const leaderboardBody = document.getElementById('leaderboard-body');

themeSelect.addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value);
});

socket.on('connect', () => {
  myId = socket.id;
});

// Setup actions
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
  roomStatus.textContent = `Room: ${roomCode} | ${difficulty.toUpperCase()} | 3 Strikes Mode | Waiting (1/${maxPlayers})...`;
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
  lobbyView.classList.add('hidden');
  gameView.classList.remove('hidden');
  eliminatedBanner.classList.add('hidden');
  currentRoomSpan.textContent = currentRoomCode;
  updateLivesDisplay(0);
  updateTimerDisplay(duration);

  // Initialize Scoreboard
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

// Receive verification feedback
socket.on('moveResult', ({ row, col, correct, mistakes, eliminated }) => {
  const input = document.querySelector(`input[data-row="${row}"][data-col="${col}"]`);
  if (!input) return;

  if (correct) {
    input.classList.remove('wrong');
    input.classList.add('correct');
    input.disabled = true;
  } else {
    input.classList.add('wrong');
    updateLivesDisplay(mistakes);

    if (eliminated) {
      isEliminated = true;
      eliminatedBanner.classList.remove('hidden');
      // Lock all empty inputs
      document.querySelectorAll('.cell input:not(.correct)').forEach(i => i.disabled = true);
    }

    setTimeout(() => {
      input.classList.remove('wrong');
      input.value = '';
    }, 500);
  }
});

// Update opponents & self in scoreboard
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

// End Game Leaderboard Display
socket.on('gameOver', ({ reason, leaderboard }) => {
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
      <td>${player.eliminated ? '❌ Struck Out' : '✅ Survived'}</td>
    `;
    leaderboardBody.appendChild(tr);
  });

  winnerModal.classList.remove('hidden');
});