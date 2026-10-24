document.addEventListener('DOMContentLoaded', () => {
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

  // Continuous Instrumental Soundtrack
  const bgAudio = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3');
  bgAudio.loop = true;
  bgAudio.volume = 0.25;

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

  // DOM Elements
  const scenicBg = document.getElementById('scenic-bg');
  const resultFlashScreen = document.getElementById('result-flash-screen');
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
  const winnerTitle = document.getElementById('winner-title');
  const winnerReason = document.getElementById('winner-reason');
  const leaderboardBody = document.getElementById('leaderboard-body');
  const modalCloseX = document.getElementById('modal-close-x');

  // --- PROCEDURAL AUDIO SYNTHESIZERS ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

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

  // 1. Right Move (Crystalline chime)
  function playSuccessSound() {
    playTone(587.33, 'sine', 0.09, 0.09);
    setTimeout(() => playTone(880, 'sine', 0.16, 0.09), 75);
  }

  // 2. Wrong Move (Pitch-dropping heavy buzz)
  function playErrorSound() {
    if (!isSoundEnabled) return;
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.32);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.33);
    } catch (e) {}
  }

  // 3. Line / 3x3 Block Complete (Ascending arpeggio)
  function playSectionCompleteSound() {
    playTone(523.25, 'triangle', 0.12, 0.1);
    setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.1), 90);
    setTimeout(() => playTone(783.99, 'triangle', 0.12, 0.1), 180);
    setTimeout(() => playTone(1046.50, 'triangle', 0.25, 0.12), 270);
  }

  // 4. Dramatic Victory Brass Fanfare
  function playDramaticVictory() {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const brassNotes = [
      { freq: 261.63, delay: 0.0, dur: 0.35 },
      { freq: 329.63, delay: 0.15, dur: 0.35 },
      { freq: 392.00, delay: 0.30, dur: 0.35 },
      { freq: 523.25, delay: 0.45, dur: 0.65 },
      { freq: 659.25, delay: 0.70, dur: 0.50 },
      { freq: 783.99, delay: 0.90, dur: 0.90 },
      { freq: 1046.5, delay: 1.15, dur: 1.40 }
    ];

    brassNotes.forEach(n => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(n.freq * 0.5, now + n.delay);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now + n.delay);

      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.linearRampToValueAtTime(0.09, now + n.delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.delay);
      osc2.start(now + n.delay);
      osc.stop(now + n.delay + n.dur);
      osc2.stop(now + n.delay + n.dur);
    });
  }

  // 5. Dramatic Defeat Cadence
  function playDramaticLoss() {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const minorDescent = [
      { freq: 220.00, delay: 0.0, dur: 0.7 },
      { freq: 207.65, delay: 0.45, dur: 0.7 },
      { freq: 196.00, delay: 0.90, dur: 0.8 },
      { freq: 146.83, delay: 1.40, dur: 1.8 }
    ];

    minorDescent.forEach(n => {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      sub.type = 'sine';
      sub.frequency.setValueAtTime(n.freq * 0.5, now + n.delay);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now + n.delay);

      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.linearRampToValueAtTime(0.12, now + n.delay + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.delay);
      sub.start(now + n.delay);
      osc.stop(now + n.delay + n.dur);
      sub.stop(now + n.delay + n.dur);
    });
  }

  // 6. Draw / Tie Dual-Tone Chime
  function playDrawSound() {
    if (!isSoundEnabled) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    [392.00, 523.25].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.9);
    });
  }

  // 7. Resign Neutral Tone
  function playResignSound() {
    playTone(440, 'sine', 0.22, 0.08);
    setTimeout(() => playTone(330, 'sine', 0.40, 0.08), 120);
  }

  // Mode radio selector
  document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'bot') {
        colMaxPlayers?.classList.add('hidden');
        colBotSpeed?.classList.remove('hidden');
        multiJoinContainer?.classList.add('hidden');
        if (createBtn) createBtn.textContent = 'Start vs Bot 🤖';
      } else {
        colMaxPlayers?.classList.remove('hidden');
        colBotSpeed?.classList.add('hidden');
        multiJoinContainer?.classList.remove('hidden');
        if (createBtn) createBtn.textContent = 'Create Room';
      }
    });
  });

  // Settings Modal Handlers
  settingsOpenBtn?.addEventListener('click', () => settingsModal?.classList.remove('hidden'));
  const closeSettings = () => settingsModal?.classList.add('hidden');
  settingsCloseX?.addEventListener('click', closeSettings);
  settingsSaveBtn?.addEventListener('click', closeSettings);

  bgSelect?.addEventListener('change', (e) => {
    if (scenicBg) scenicBg.className = `scenic-bg bg-${e.target.value}`;
  });
  themeSelect?.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    document.documentElement.style.removeProperty('--accent');
  });
  fontSelect?.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-font', e.target.value);
  });
  customColorPicker?.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--accent', e.target.value);
  });

  soundToggle?.addEventListener('change', (e) => isSoundEnabled = e.target.checked);
  emojiToggle?.addEventListener('change', (e) => isEmojiEnabled = e.target.checked);
  musicToggle?.addEventListener('change', (e) => {
    isMusicEnabled = e.target.checked;
    if (isMusicEnabled) {
      bgAudio.play().catch(() => {});
    } else {
      bgAudio.pause();
    }
  });

  modalCloseX?.addEventListener('click', () => winnerModal?.classList.add('hidden'));

  function spawnFloatingEmoji(cellElement, emojiList = ['✨', '🔥', '⭐', '🎯', '🚀']) {
    if (!isEmojiEnabled || !cellElement) return;
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

  createBtn?.addEventListener('click', () => {
    getAudioContext();
    if (isMusicEnabled) bgAudio.play().catch(() => {});

    const username = usernameInput?.value.trim() || 'Player 1';
    const difficulty = difficultySelect?.value || 'medium';
    const durationMinutes = parseInt(customDurationInput?.value, 10) || 10;
    const symbolSet = symbolSetSelect?.value || 'numbers';
    const selectedMode = document.querySelector('input[name="game-mode"]:checked')?.value || 'multi';

    if (selectedMode === 'bot') {
      const botSpeed = botSpeedSelect?.value || 'medium';
      socket.emit('createSoloBotRoom', { username, difficulty, botSpeed, durationMinutes, symbolSet });
    } else {
      const maxPlayers = maxPlayersSelect?.value || 2;
      socket.emit('createRoom', { username, difficulty, maxPlayers, durationMinutes, symbolSet });
    }
  });

  joinBtn?.addEventListener('click', () => {
    getAudioContext();
    if (isMusicEnabled) bgAudio.play().catch(() => {});

    const username = usernameInput?.value.trim() || 'Player';
    const roomCode = roomCodeInput?.value.trim();
    if (!roomCode) {
      alert('Please enter a room code');
      return;
    }
    socket.emit('joinRoom', { roomCode, username });
  });

  quitBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to resign from the match?')) {
      socket.emit('quitGame', { roomCode: currentRoomCode });
      triggerPlayerEliminated('🏳️ You resigned from the match.');
    }
  });

  socket.on('roomCreated', ({ roomCode, maxPlayers, difficulty, durationMinutes, symbolSet }) => {
    currentRoomCode = roomCode;
    if (roomStatus) roomStatus.textContent = `Room: ${roomCode} | Mode: ${symbolSet.toUpperCase()} | Waiting (1/${maxPlayers})...`;
  });

  socket.on('joinedRoomSuccess', ({ roomCode }) => {
    currentRoomCode = roomCode;
    if (roomStatus) roomStatus.textContent = `Joined ${roomCode}! Waiting for match...`;
  });

  socket.on('playerListUpdate', (players) => {
    if (lobbyRoster) lobbyRoster.innerHTML = '<strong>Players Joined:</strong> ' + players.map(p => p.name).join(', ');
  });

  socket.on('errorMessage', (msg) => alert(msg));
  socket.on('playerDisconnected', ({ name }) => alert(`${name} left the room.`));

  socket.on('startGame', ({ puzzle, players, totalBlanks, duration, symbolSet, roomCode }) => {
    isEliminated = false;
    selectedCell = null;
    activeSymbolSet = symbolSet || 'numbers';
    currentRoomCode = roomCode || currentRoomCode;
    if (quitBtn) quitBtn.disabled = false;
    completedRows.clear();
    completedCols.clear();
    completedBoxes.clear();

    if (resultFlashScreen) resultFlashScreen.className = 'result-flash-screen';

    lobbyView?.classList.add('hidden');
    gameView?.classList.remove('hidden', 'game-locked');
    eliminatedBanner?.classList.add('hidden');
    winnerModal?.classList.add('hidden');
    if (currentRoomSpan) currentRoomSpan.textContent = currentRoomCode;

    updateLivesDisplay(0);
    updateTimerDisplay(duration);

    if (scoreboard) {
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
    }

    renderBoard(puzzle);
    renderSymbolPad();
  });

  function updateLivesDisplay(mistakes) {
    if (!myLivesDisplay) return;
    const livesLeft = Math.max(0, 3 - mistakes);
    myLivesDisplay.textContent = 'Lives: ' + '❤️'.repeat(livesLeft) + '🖤'.repeat(3 - livesLeft);
  }

  socket.on('timerTick', ({ timeLeft }) => updateTimerDisplay(timeLeft));

  function updateTimerDisplay(seconds) {
    if (!timerDisplay) return;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerDisplay.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updateExhaustedSymbols() {
    const counts = {};
    for (let i = 1; i <= 9; i++) counts[i] = 0;

    document.querySelectorAll('.cell').forEach(cell => {
      const val = parseInt(cell.dataset.val, 10);
      if (val && (cell.classList.contains('prefilled') || cell.classList.contains('correct'))) {
        counts[val] = (counts[val] || 0) + 1;
      }
    });

    for (let num = 1; num <= 9; num++) {
      const btn = document.querySelector(`.symbol-btn[data-val="${num}"]`);
      if (btn) {
        if (counts[num] >= 9) {
          btn.classList.add('exhausted');
        } else {
          btn.classList.remove('exhausted');
        }
      }
    }
  }

  function renderBoard(puzzle) {
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = puzzle[r][c];
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.dataset.val = val;

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
    updateExhaustedSymbols();
  }

  function renderSymbolPad() {
    if (!symbolPad) return;
    symbolPad.innerHTML = '';
    const symbols = SYMBOL_SETS[activeSymbolSet] || SYMBOL_SETS.numbers;

    symbols.forEach((symbol, index) => {
      const val = index + 1;
      const btn = document.createElement('button');
      btn.classList.add('symbol-btn');
      btn.dataset.val = val;
      btn.textContent = symbol;

      btn.addEventListener('click', () => {
        if (isEliminated || !selectedCell) return;
        makeMove(parseInt(selectedCell.dataset.row, 10), parseInt(selectedCell.dataset.col, 10), val);
      });

      symbolPad.appendChild(btn);
    });
    updateExhaustedSymbols();
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
      cell.dataset.val = value;
      selectedCell = null;

      checkCompletions();
      updateExhaustedSymbols();
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

    if (anyCompleted) {
      playSectionCompleteSound();
    }
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
    if (quitBtn) quitBtn.disabled = true;
    if (eliminatedBanner) {
      eliminatedBanner.textContent = message;
      eliminatedBanner.classList.remove('hidden');
    }
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

  // Match Finish: Dynamic Audio and Background Wash
  socket.on('gameOver', ({ reason, leaderboard, outcome }) => {
    gameView?.classList.add('game-locked');
    if (quitBtn) quitBtn.disabled = true;

    const isMeWinner = leaderboard.length > 0 && leaderboard[0].id === myId;
    const isMeEliminated = leaderboard.find(p => p.id === myId)?.eliminated;

    if (outcome === 'resign' && isMeEliminated) {
      if (resultFlashScreen) resultFlashScreen.className = 'result-flash-screen flash-resign';
      if (winnerTitle) winnerTitle.textContent = '🏳️ RESIGNED';
      playResignSound();
    } else if (isMeWinner) {
      if (resultFlashScreen) resultFlashScreen.className = 'result-flash-screen flash-win';
      if (winnerTitle) winnerTitle.textContent = '🏆 VICTORY!';
      playDramaticVictory();
    } else if (isMeEliminated || outcome === 'loss') {
      if (resultFlashScreen) resultFlashScreen.className = 'result-flash-screen flash-loss';
      if (winnerTitle) winnerTitle.textContent = '💀 DEFEAT';
      playDramaticLoss();
    } else {
      if (resultFlashScreen) resultFlashScreen.className = 'result-flash-screen flash-draw';
      if (winnerTitle) winnerTitle.textContent = '⚖️ MATCH DRAW';
      playDrawSound();
    }

    if (winnerReason) winnerReason.textContent = reason;
    if (leaderboardBody) {
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
    }

    winnerModal?.classList.remove('hidden');
  });
});