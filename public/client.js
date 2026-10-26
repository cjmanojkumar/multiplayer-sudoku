document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  let currentRoomCode = null;
  let myId = null;
  let isEliminated = false;
  let selectedCell = null;
  let activeSymbolSet = 'numbers';
  let activeDifficultyLevel = 4;
  let currentUser = null;

  let isSoundEnabled = true;
  let isMusicEnabled = false;
  let isEmojiEnabled = true;

 // 20 Unique, Verified Realistic Nature Backdrops with Matching Themes
  const BACKGROUND_THEMES = {
    glacier: { 
      url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80', 
      theme: 'paper' 
    },
    redwood: { 
      url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80', 
      theme: 'emerald' 
    },
    ocean: { 
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80', 
      theme: 'dark' 
    },
    pine: { 
      url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1920&q=80', 
      theme: 'emerald' 
    },
    aurora: { 
      url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1920&q=80', 
      theme: 'neon' 
    },
    waterfall: { 
      url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1920&q=80', 
      theme: 'emerald' 
    },
    sunset: { 
      url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=1920&q=80', 
      theme: 'sunset' 
    },
    canyon: { 
      url: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=1920&q=80', 
      theme: 'sunset' 
    },
    meadow: { 
      url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80', 
      theme: 'sunset' 
    },
    canvas: { 
      url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1920&q=80', 
      theme: 'paper' 
    },
    lake: { 
      url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80', 
      theme: 'dark' 
    },
    blossom: { 
      url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1920&q=80', 
      theme: 'sunset' 
    },
    rain: { 
      url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1920&q=80', 
      theme: 'dark' 
    },
    volcano: { 
      url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80', 
      theme: 'sunset' 
    },
    bamboo: { 
      url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1920&q=80', 
      theme: 'emerald' 
    },
    galaxy: { 
      url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80', 
      theme: 'dark' 
    },
    reef: { 
      url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1920&q=80', 
      theme: 'emerald' 
    },
    cliff: { 
      url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1920&q=80', 
      theme: 'paper' 
    },
    autumn: { 
      url: 'https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?auto=format&fit=crop&w=1920&q=80', 
      theme: 'sunset' 
    },
    river: { 
      url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80', 
      theme: 'emerald' 
    }
  };

  const bgAudio = new Audio('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3');
  bgAudio.loop = true;
  bgAudio.volume = 0.25;

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

  const DIFFICULTY_TIERS = {
    1: 'Level 1: Beginner (15 blanks)',
    2: 'Level 2: Novice (22 blanks)',
    3: 'Level 3: Easy (30 blanks)',
    4: 'Level 4: Medium (38 blanks)',
    5: 'Level 5: Hard (45 blanks)',
    6: 'Level 6: Expert (50 blanks)',
    7: 'Level 7: Master (55 blanks)'
  };

  const completedRows = new Set();
  const completedCols = new Set();
  const completedBoxes = new Set();

  // DOM Elements
  const scenicBg = document.getElementById('scenic-bg');
  const resultFlashScreen = document.getElementById('result-flash-screen');
  const bgSelect = document.getElementById('bg-select');
  const fontSelect = document.getElementById('font-select');
  const difficultySlider = document.getElementById('difficulty-slider');
  const sliderLevelName = document.getElementById('slider-level-name');
  const activeDiffLabel = document.getElementById('active-diff-label');
  const activeSymbolLabel = document.getElementById('active-symbol-label');
  const symbolSetSelect = document.getElementById('symbol-set-select');

  const musicToggle = document.getElementById('music-toggle');
  const soundToggle = document.getElementById('sound-toggle');
  const emojiToggle = document.getElementById('emoji-toggle');

  const settingsOpenBtn = document.getElementById('settings-open-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsCloseX = document.getElementById('settings-close-x');
  const settingsSaveBtn = document.getElementById('settings-save-btn');

  // Password Visibility Toggle
  const authPasswordInput = document.getElementById('auth-password');
  const togglePasswordVisibilityBtn = document.getElementById('toggle-password-visibility');

  // Profile Elements
  const openProfileBtn = document.getElementById('open-profile-btn');
  const profileModal = document.getElementById('profile-modal');
  const profileCloseX = document.getElementById('profile-close-x');
  const profUsername = document.getElementById('prof-username');
  const profRole = document.getElementById('prof-role');
  const profWinRate = document.getElementById('prof-winrate');
  const profMatchesWon = document.getElementById('prof-matches-won');
  const profMatchesPlayed = document.getElementById('prof-matches-played');
  const profTotalScore = document.getElementById('prof-total-score');
  const profFriendsCount = document.getElementById('prof-friends-count');
  const profMemberSince = document.getElementById('prof-member-since');

  // Friends Elements
  const openFriendsBtn = document.getElementById('open-friends-btn');
  const friendsModal = document.getElementById('friends-modal');
  const friendsCloseX = document.getElementById('friends-close-x');
  const friendTargetInput = document.getElementById('friend-target-input');
  const sendFriendReqBtn = document.getElementById('send-friend-req-btn');
  const friendFeedbackMsg = document.getElementById('friend-feedback-msg');
  const pendingRequestsSec = document.getElementById('pending-requests-sec');
  const pendingRequestsList = document.getElementById('pending-requests-list');
  const friendsTableBody = document.getElementById('friends-table-body');
  const noFriendsMsg = document.getElementById('no-friends-msg');

  // Privacy Elements
  const privacyModal = document.getElementById('privacy-modal');
  const privacyCloseX = document.getElementById('privacy-close-x');
  const privacyAcceptBtn = document.getElementById('privacy-accept-btn');

  // History & Auth
  const openHistoryBtn = document.getElementById('open-history-btn');
  const historyModal = document.getElementById('history-modal');
  const historyCloseX = document.getElementById('history-close-x');
  const historyTableBody = document.getElementById('history-table-body');
  const noHistoryMsg = document.getElementById('no-history-msg');

  const openLoginBtn = document.getElementById('open-login-btn');
  const openRegisterBtn = document.getElementById('open-register-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const authModal = document.getElementById('auth-modal');
  const authCloseX = document.getElementById('auth-close-x');
  const authForm = document.getElementById('auth-form');
  const authModalTitle = document.getElementById('auth-modal-title');
  const authUsernameInput = document.getElementById('auth-username');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authSwitchMsg = document.getElementById('auth-switch-msg');
  const authToggleLink = document.getElementById('auth-toggle-link');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const guestAuthControls = document.getElementById('guest-auth-controls');
  const loggedAuthControls = document.getElementById('logged-auth-controls');
  const loggedUsernameSpan = document.getElementById('logged-username');
  const userStatsSpan = document.getElementById('user-stats');

  const adminOpenBtn = document.getElementById('admin-open-btn');
  const adminModal = document.getElementById('admin-modal');
  const adminCloseX = document.getElementById('admin-close-x');
  const adminLoginSec = document.getElementById('admin-login-sec');
  const adminDashboardSec = document.getElementById('admin-dashboard-sec');
  const adminSecretInput = document.getElementById('admin-secret-input');
  const adminUnlockBtn = document.getElementById('admin-unlock-btn');
  const adminErrorMsg = document.getElementById('admin-error-msg');
  const adminUsersTableBody = document.getElementById('admin-users-table-body');
  const totalUsersCount = document.getElementById('total-users-count');
  const adminRefreshBtn = document.getElementById('admin-refresh-btn');

  const lobbyView = document.getElementById('lobby-view');
  const gameView = document.getElementById('game-view');
  const usernameInput = document.getElementById('username');
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

  // --- PASSWORD VISIBILITY TOGGLE ---
  togglePasswordVisibilityBtn?.addEventListener('click', () => {
    if (!authPasswordInput) return;
    const isPass = authPasswordInput.type === 'password';
    authPasswordInput.type = isPass ? 'text' : 'password';
    togglePasswordVisibilityBtn.textContent = isPass ? '🙈' : '👁️';
  });

  // --- PERSISTENT SETTINGS ---
  function saveGameSettings() {
    const settings = {
      difficultyLevel: activeDifficultyLevel,
      symbolSet: activeSymbolSet,
      background: bgSelect?.value || 'galaxy',
      font: fontSelect?.value || 'default',
      music: isMusicEnabled,
      sound: isSoundEnabled,
      emoji: isEmojiEnabled
    };
    localStorage.setItem('sudoku_arena_settings', JSON.stringify(settings));
  }

  function loadGameSettings() {
    const raw = localStorage.getItem('sudoku_arena_settings');
    if (!raw) return;

    try {
      const s = JSON.parse(raw);
      if (s.difficultyLevel) {
        activeDifficultyLevel = parseInt(s.difficultyLevel, 10);
        if (difficultySlider) difficultySlider.value = activeDifficultyLevel;
        const label = DIFFICULTY_TIERS[activeDifficultyLevel] || DIFFICULTY_TIERS[4];
        if (sliderLevelName) sliderLevelName.textContent = label;
        if (activeDiffLabel) activeDiffLabel.textContent = label.split(' (')[0];
      }

      if (s.symbolSet && SYMBOL_SETS[s.symbolSet]) {
        activeSymbolSet = s.symbolSet;
        if (symbolSetSelect) symbolSetSelect.value = s.symbolSet;
        if (activeSymbolLabel && symbolSetSelect) {
          activeSymbolLabel.textContent = symbolSetSelect.options[symbolSetSelect.selectedIndex]?.text || '1-9 Numbers';
        }
      }

      if (s.background && BACKGROUND_THEMES[s.background]) {
        if (bgSelect) bgSelect.value = s.background;
        const config = BACKGROUND_THEMES[s.background];
        if (scenicBg) scenicBg.style.backgroundImage = `url('${config.url}')`;
        document.documentElement.setAttribute('data-theme', config.theme);
      }

      if (s.font) {
        if (fontSelect) fontSelect.value = s.font;
        document.documentElement.setAttribute('data-font', s.font);
      }

      if (typeof s.sound === 'boolean') {
        isSoundEnabled = s.sound;
        if (soundToggle) soundToggle.checked = isSoundEnabled;
      }
      if (typeof s.music === 'boolean') {
        isMusicEnabled = s.music;
        if (musicToggle) musicToggle.checked = isMusicEnabled;
      }
      if (typeof s.emoji === 'boolean') {
        isEmojiEnabled = s.emoji;
        if (emojiToggle) emojiToggle.checked = isEmojiEnabled;
      }
    } catch (e) {}
  }

  // --- SETTINGS CONTROLS ---
  difficultySlider?.addEventListener('input', (e) => {
    activeDifficultyLevel = parseInt(e.target.value, 10);
    const label = DIFFICULTY_TIERS[activeDifficultyLevel];
    if (sliderLevelName) sliderLevelName.textContent = label;
    if (activeDiffLabel) activeDiffLabel.textContent = label.split(' (')[0];
    saveGameSettings();
  });

  symbolSetSelect?.addEventListener('change', (e) => {
    activeSymbolSet = e.target.value;
    const readable = symbolSetSelect.options[symbolSetSelect.selectedIndex].text;
    if (activeSymbolLabel) activeSymbolLabel.textContent = readable;
    saveGameSettings();
  });

  bgSelect?.addEventListener('change', (e) => {
    const chosenKey = e.target.value;
    const config = BACKGROUND_THEMES[chosenKey];
    if (scenicBg && config) {
      scenicBg.style.backgroundImage = `url('${config.url}')`;
      document.documentElement.setAttribute('data-theme', config.theme);
    }
    saveGameSettings();
  });

  fontSelect?.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-font', e.target.value);
    saveGameSettings();
  });

  soundToggle?.addEventListener('change', (e) => {
    isSoundEnabled = e.target.checked;
    saveGameSettings();
  });

  emojiToggle?.addEventListener('change', (e) => {
    isEmojiEnabled = e.target.checked;
    saveGameSettings();
  });

  musicToggle?.addEventListener('change', (e) => {
    isMusicEnabled = e.target.checked;
    if (isMusicEnabled) bgAudio.play().catch(() => {});
    else bgAudio.pause();
    saveGameSettings();
  });

  loadGameSettings();

  // --- PRIVACY GATE (Pops BEFORE Registering) ---
  openRegisterBtn?.addEventListener('click', () => {
    privacyModal?.classList.remove('hidden');
  });

  privacyCloseX?.addEventListener('click', () => privacyModal?.classList.add('hidden'));

  privacyAcceptBtn?.addEventListener('click', () => {
    privacyModal?.classList.add('hidden');
    openAuth(true);
  });

  // --- PLAYER PROFILE MODAL ---
  openProfileBtn?.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/user/profile/${encodeURIComponent(currentUser.username)}`);
      const data = await res.json();
      if (!data.success) return alert(data.error || 'Failed to load profile.');

      const p = data.profile;
      profUsername.textContent = p.username;
      profRole.textContent = p.role.toUpperCase();
      profWinRate.textContent = p.winRate;
      profMatchesWon.textContent = p.matchesWon;
      profMatchesPlayed.textContent = p.matchesPlayed;
      profTotalScore.textContent = p.totalScore;
      profFriendsCount.textContent = p.friendsCount;
      profMemberSince.textContent = new Date(p.registeredAt).toLocaleDateString([], { month: 'short', year: 'numeric' });

      profileModal?.classList.remove('hidden');
    } catch (err) {
      alert('Could not retrieve player profile.');
    }
  });

  profileCloseX?.addEventListener('click', () => profileModal?.classList.add('hidden'));

  // --- FRIENDS HUB ---
  async function refreshFriendsList() {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/friends/list/${encodeURIComponent(currentUser.username)}`);
      const data = await res.json();
      if (!data.success) return;

      if (data.requests && data.requests.length > 0) {
        pendingRequestsSec.classList.remove('hidden');
        pendingRequestsList.innerHTML = '';
        data.requests.forEach(reqUser => {
          const div = document.createElement('div');
          div.className = 'request-item';
          div.innerHTML = `
            <span><strong>${reqUser}</strong> sent you a request</span>
            <div class="request-actions">
              <button class="btn primary small sketch-btn" onclick="respondFriendReq('${reqUser}', 'accept')">Accept</button>
              <button class="btn danger-small sketch-border" onclick="respondFriendReq('${reqUser}', 'decline')">Decline</button>
            </div>
          `;
          pendingRequestsList.appendChild(div);
        });
      } else {
        pendingRequestsSec.classList.add('hidden');
      }

      friendsTableBody.innerHTML = '';
      if (data.friends && data.friends.length > 0) {
        noFriendsMsg.classList.add('hidden');
        data.friends.forEach(f => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${f.username}</strong></td>
            <td>
              <span class="status-badge ${f.online ? 'online' : 'offline'}">
                <span class="status-dot"></span> ${f.online ? 'Online' : 'Offline'}
              </span>
            </td>
            <td>
              <button class="btn danger-small sketch-border" onclick="respondFriendReq('${f.username}', 'decline')">Remove</button>
            </td>
          `;
          friendsTableBody.appendChild(tr);
        });
      } else {
        noFriendsMsg.classList.remove('hidden');
      }
    } catch (e) {}
  }

  window.respondFriendReq = async function(fromUser, action) {
    if (!currentUser) return;
    try {
      await fetch('/api/friends/respond-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, fromUser, action })
      });
      refreshFriendsList();
    } catch (e) {}
  };

  openFriendsBtn?.addEventListener('click', () => {
    friendFeedbackMsg.classList.add('hidden');
    friendTargetInput.value = '';
    refreshFriendsList();
    friendsModal?.classList.remove('hidden');
  });

  friendsCloseX?.addEventListener('click', () => friendsModal?.classList.add('hidden'));

  sendFriendReqBtn?.addEventListener('click', async () => {
    const target = friendTargetInput.value.trim();
    if (!target || !currentUser) return;

    try {
      const res = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUser: currentUser.username, targetUser: target })
      });
      const data = await res.json();
      friendFeedbackMsg.textContent = data.message || data.error;
      friendFeedbackMsg.classList.remove('hidden');
      if (data.success) {
        friendTargetInput.value = '';
        refreshFriendsList();
      }
    } catch (err) {
      friendFeedbackMsg.textContent = 'Failed to send request.';
      friendFeedbackMsg.classList.remove('hidden');
    }
  });

  socket.on('friendRequestReceived', ({ from }) => {
    alert(`👥 New friend request received from ${from}!`);
    refreshFriendsList();
  });

  socket.on('friendStatusChanged', () => {
    refreshFriendsList();
  });

  // --- AUTH & REGISTRATION ---
  let isRegisterMode = false;

  function loadPersistedUser() {
    const saved = localStorage.getItem('sudoku_active_user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        updateAuthUI();
        socket.emit('registerOnlineUser', { username: currentUser.username });
      } catch (e) {
        currentUser = null;
      }
    }
  }

  function updateAuthUI() {
    if (currentUser) {
      guestAuthControls.classList.add('hidden');
      loggedAuthControls.classList.remove('hidden');
      loggedUsernameSpan.textContent = currentUser.username;
      userStatsSpan.textContent = `${currentUser.matchesWon || 0}W / ${currentUser.matchesPlayed || 0}P`;
      if (usernameInput) usernameInput.value = currentUser.username;
    } else {
      guestAuthControls.classList.remove('hidden');
      loggedAuthControls.classList.add('hidden');
    }
  }

  function openAuth(isRegister) {
    isRegisterMode = isRegister;
    authErrorMsg.classList.add('hidden');
    authUsernameInput.value = '';
    authPasswordInput.value = '';
    authPasswordInput.type = 'password';
    if (togglePasswordVisibilityBtn) togglePasswordVisibilityBtn.textContent = '👁️';

    if (isRegisterMode) {
      authModalTitle.textContent = '📝 Register Player';
      authSubmitBtn.textContent = 'Create Account';
      authSwitchMsg.textContent = 'Already have an account?';
      authToggleLink.textContent = 'Log In here';
    } else {
      authModalTitle.textContent = '🔑 Player Login';
      authSubmitBtn.textContent = 'Log In';
      authSwitchMsg.textContent = "Don't have an account?";
      authToggleLink.textContent = 'Register here';
    }
    authModal.classList.remove('hidden');
  }

  openLoginBtn?.addEventListener('click', () => openAuth(false));
  authCloseX?.addEventListener('click', () => authModal.classList.add('hidden'));

  authToggleLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isRegisterMode) {
      authModal.classList.add('hidden');
      privacyModal?.classList.remove('hidden');
    } else {
      openAuth(false);
    }
  });

  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorMsg.classList.add('hidden');

    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;
    const endpoint = isRegisterMode ? '/api/register' : '/api/login';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        authErrorMsg.textContent = data.error || 'Authentication error';
        authErrorMsg.classList.remove('hidden');
        return;
      }

      currentUser = data.user;
      localStorage.setItem('sudoku_active_user', JSON.stringify(currentUser));
      updateAuthUI();
      socket.emit('registerOnlineUser', { username: currentUser.username });
      authModal.classList.add('hidden');
    } catch (err) {
      authErrorMsg.textContent = 'Server connection failed.';
      authErrorMsg.classList.remove('hidden');
    }
  });

  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('sudoku_active_user');
    currentUser = null;
    updateAuthUI();
  });

  loadPersistedUser();

  // Personal Match History
  openHistoryBtn?.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/user/history/${encodeURIComponent(currentUser.username)}`);
      const data = await res.json();
      historyTableBody.innerHTML = '';

      if (data.success && data.history.length > 0) {
        noHistoryMsg.classList.add('hidden');
        data.history.forEach(item => {
          const tr = document.createElement('tr');
          const d = new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          tr.innerHTML = `
            <td>${d}</td>
            <td><strong>${item.outcome}</strong></td>
            <td>${item.mode}</td>
            <td>Level ${item.difficultyLevel}</td>
            <td>${item.score}/${item.totalBlanks}</td>
            <td>${item.mistakes}/3</td>
          `;
          historyTableBody.appendChild(tr);
        });
      } else {
        noHistoryMsg.classList.remove('hidden');
      }
      historyModal.classList.remove('hidden');
    } catch (e) {
      alert('Unable to load history.');
    }
  });

  historyCloseX?.addEventListener('click', () => historyModal.classList.add('hidden'));

  // Admin Portal
 adminOpenBtn?.addEventListener('click', () => {
    settingsModal?.classList.add('hidden'); // Closes settings when admin opens
    adminSecretInput.value = '';
    adminErrorMsg.classList.add('hidden');
    adminLoginSec.classList.remove('hidden');
    adminDashboardSec.classList.add('hidden');
    adminModal.classList.remove('hidden');
  });
  
  adminCloseX?.addEventListener('click', () => adminModal.classList.add('hidden'));

  async function fetchAdminUsers(key) {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: key })
      });
      const data = await res.json();

      if (!res.ok) {
        adminErrorMsg.textContent = data.error || 'Access denied';
        adminErrorMsg.classList.remove('hidden');
        return;
      }

      adminLoginSec.classList.add('hidden');
      adminDashboardSec.classList.remove('hidden');
      totalUsersCount.textContent = `Total Registered Players: ${data.users.length}`;

      adminUsersTableBody.innerHTML = '';
      data.users.forEach(u => {
        const tr = document.createElement('tr');
        const regDate = new Date(u.registeredAt).toLocaleDateString();
        tr.innerHTML = `
          <td><strong>${u.username}</strong></td>
          <td><span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></td>
          <td>${u.matchesPlayed || 0}</td>
          <td>${u.matchesWon || 0}</td>
          <td>${regDate}</td>
        `;
        adminUsersTableBody.appendChild(tr);
      });
    } catch (err) {
      adminErrorMsg.textContent = 'Failed to load users.';
      adminErrorMsg.classList.remove('hidden');
    }
  }

  adminUnlockBtn?.addEventListener('click', () => {
    const key = adminSecretInput.value.trim();
    if (key) fetchAdminUsers(key);
  });

  adminRefreshBtn?.addEventListener('click', () => {
    const key = adminSecretInput.value.trim();
    if (key) fetchAdminUsers(key);
  });

  // --- WHITE GLITTER PARTICLES ---
  const glitterCanvas = document.getElementById('glitter-canvas');
  if (glitterCanvas) {
    const gCtx = glitterCanvas.getContext('2d');
    let width = (glitterCanvas.width = window.innerWidth);
    let height = (glitterCanvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = glitterCanvas.width = window.innerWidth;
      height = glitterCanvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 75 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 0.8,
      speedY: Math.random() * 0.4 + 0.15,
      speedX: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.8 + 0.2,
      alphaSpeed: (Math.random() * 0.02 + 0.008) * (Math.random() < 0.5 ? 1 : -1)
    }));

    function renderGlitter() {
      gCtx.clearRect(0, 0, width, height);
      for (let p of particles) {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.alpha += p.alphaSpeed;

        if (p.alpha <= 0.1 || p.alpha >= 0.95) p.alphaSpeed = -p.alphaSpeed;
        if (p.y < -5) p.y = height + 5;
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;

        gCtx.save();
        gCtx.beginPath();
        gCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        gCtx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, p.alpha)})`;
        gCtx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        gCtx.shadowBlur = 6;
        gCtx.fill();
        gCtx.restore();
      }
      requestAnimationFrame(renderGlitter);
    }
    renderGlitter();
  }

  // --- PROCEDURAL AUDIO ---
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

  function playSuccessSound() {
    playTone(587.33, 'sine', 0.09, 0.09);
    setTimeout(() => playTone(880, 'sine', 0.16, 0.09), 75);
  }

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

  function playSectionCompleteSound() {
    playTone(523.25, 'triangle', 0.12, 0.1);
    setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.1), 90);
    setTimeout(() => playTone(783.99, 'triangle', 0.12, 0.1), 180);
    setTimeout(() => playTone(1046.50, 'triangle', 0.25, 0.12), 270);
  }

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
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now + n.delay);
      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.linearRampToValueAtTime?.(0.09, now + n.delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.dur);
    });
  }

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
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now + n.delay);
      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.linearRampToValueAtTime?.(0.12, now + n.delay + 0.08);
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
      gain.linearRampToValueAtTime?.(0.08, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.9);
    });
  }

  function playResignSound() {
    playTone(440, 'sine', 0.22, 0.08);
    setTimeout(() => playTone(330, 'sine', 0.40, 0.08), 120);
  }

  // Settings Handlers
  settingsOpenBtn?.addEventListener('click', () => settingsModal?.classList.remove('hidden'));
  const closeSettings = () => settingsModal?.classList.add('hidden');
  settingsCloseX?.addEventListener('click', closeSettings);
  settingsSaveBtn?.addEventListener('click', () => {
    saveGameSettings();
    closeSettings();
  });

  modalCloseX?.addEventListener('click', () => winnerModal?.classList.add('hidden'));

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

    const username = usernameInput?.value.trim() || currentUser?.username || 'Player 1';
    const durationMinutes = parseInt(customDurationInput?.value, 10) || 10;
    const selectedMode = document.querySelector('input[name="game-mode"]:checked')?.value || 'multi';

    if (selectedMode === 'bot') {
      const botSpeed = botSpeedSelect?.value || 'medium';
      socket.emit('createSoloBotRoom', { 
        username, 
        difficultyLevel: activeDifficultyLevel, 
        botSpeed, 
        durationMinutes, 
        symbolSet: activeSymbolSet 
      });
    } else {
      const maxPlayers = maxPlayersSelect?.value || 2;
      socket.emit('createRoom', { 
        username, 
        difficultyLevel: activeDifficultyLevel, 
        maxPlayers, 
        durationMinutes, 
        symbolSet: activeSymbolSet 
      });
    }
  });

  joinBtn?.addEventListener('click', () => {
    getAudioContext();
    if (isMusicEnabled) bgAudio.play().catch(() => {});

    const username = usernameInput?.value.trim() || currentUser?.username || 'Player';
    const roomCode = roomCodeInput?.value.trim();
    if (!roomCode) return alert('Please enter a room code');
    socket.emit('joinRoom', { roomCode, username });
  });

  quitBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to resign from the match?')) {
      socket.emit('quitGame', { roomCode: currentRoomCode });
      triggerPlayerEliminated('🏳️ You resigned from the match.');
    }
  });

  socket.on('roomCreated', ({ roomCode, maxPlayers, difficultyLevel, durationMinutes, symbolSet }) => {
    currentRoomCode = roomCode;
    if (roomStatus) roomStatus.textContent = `Room: ${roomCode} | Level: ${difficultyLevel} | Waiting (1/${maxPlayers})...`;
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
        if (counts[num] >= 9) btn.classList.add('exhausted');
        else btn.classList.remove('exhausted');
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
    socket.emit('submitMove', { roomCode: currentRoomCode, row, col, value });
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

    if (anyCompleted) playSectionCompleteSound();
  }

  function isCellSolved(cell) {
    return cell && (cell.classList.contains('prefilled') || cell.classList.contains('correct'));
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
const fontColorPicker = document.getElementById('font-color-picker');

fontColorPicker?.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--text', e.target.value);
  document.documentElement.style.setProperty('--number-color', e.target.value);
});