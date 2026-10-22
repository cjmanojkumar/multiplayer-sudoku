const socket = io();

let currentRoomCode = null;
let currentBlanks = 0;
let myId = null;

// DOM Elements
const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('room-code-input');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomStatus = document.getElementById('room-status');
const currentRoomSpan = document.getElementById('current-room');
const gridContainer = document.getElementById('sudoku-grid');
const winnerModal = document.getElementById('winner-modal');
const winnerMessage = document.getElementById('winner-message');

const p1Name = document.getElementById('p1-name');
const p1Bar = document.getElementById('p1-bar');
const p1Score = document.getElementById('p1-score');

const p2Name = document.getElementById('p2-name');
const p2Bar = document.getElementById('p2-bar');
const p2Score = document.getElementById('p2-score');

// Get socket ID on connect
socket.on('connect', () => {
  myId = socket.id;
});

// Event Listeners
createBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim() || 'Player 1';
  socket.emit('createRoom', { username });
});

joinBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim() || 'Player 2';
  const roomCode = roomCodeInput.value.trim();
  if (!roomCode) {
    alert('Please enter a room code');
    return;
  }
  socket.emit('joinRoom', { roomCode, username });
});

// Socket Events
socket.on('roomCreated', ({ roomCode }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Room created: ${roomCode}. Waiting for an opponent to join...`;
});

socket.on('joinedRoomSuccess', ({ roomCode }) => {
  currentRoomCode = roomCode;
  roomStatus.textContent = `Joined room ${roomCode}! Preparing game...`;
});

socket.on('errorMessage', (msg) => {
  alert(msg);
});

socket.on('playerDisconnected', ({ name }) => {
  alert(`${name} disconnected from the match.`);
});

socket.on('startGame', ({ puzzle, players, totalBlanks }) => {
  currentBlanks = totalBlanks;
  lobbyView.classList.add('hidden');
  gameView.classList.remove('hidden');
  currentRoomSpan.textContent = currentRoomCode;

  // Initialize Scoreboard
  p1Name.textContent = players[0].name;
  p1Score.textContent = `0 / ${totalBlanks}`;
  p2Name.textContent = players[1].name;
  p2Score.textContent = `0 / ${totalBlanks}`;

  renderBoard(puzzle);
});

function renderBoard(puzzle) {
  gridContainer.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cellVal = puzzle[r][c];
      const cellDiv = document.createElement('div');
      cellDiv.classList.add('cell');

      if (cellVal !== 0) {
        cellDiv.classList.add('prefilled');
        cellDiv.textContent = cellVal;
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.dataset.row = r;
        input.dataset.col = c;

        input.addEventListener('input', (e) => {
          const val = e.target.value;
          if (!/^[1-9]$/.test(val)) {
            e.target.value = '';
            return;
          }
          socket.emit('submitMove', {
            roomCode: currentRoomCode,
            row: parseInt(e.target.dataset.row, 10),
            col: parseInt(e.target.dataset.col, 10),
            value: val
          });
        });

        cellDiv.appendChild(input);
      }
      gridContainer.appendChild(cellDiv);
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
    }, 600);
  }
});

socket.on('progressUpdate', ({ playerId, score, totalBlanks }) => {
  const pct = Math.min(100, Math.round((score / totalBlanks) * 100));
  if (playerId === myId) {
    p1Bar.style.width = `${pct}%`;
    p1Score.textContent = `${score} / ${totalBlanks}`;
  } else {
    p2Bar.style.width = `${pct}%`;
    p2Score.textContent = `${score} / ${totalBlanks}`;
  }
});

socket.on('gameOver', ({ winner }) => {
  winnerMessage.textContent = `🏆 ${winner} Won the Match!`;
  winnerModal.classList.remove('hidden');
});