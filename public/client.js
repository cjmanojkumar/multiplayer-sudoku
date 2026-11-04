document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  let currentRoomCode = null;
  let myId = null;
  let isEliminated = false;
  let isCompleted = false;
  let isAbandoned = false;
  let selectedCell = null;
  let activeSymbolSet = 'numbers';
  let activeDifficultyLevel = 4;
  let currentUser = null;

  let isSoundEnabled = true;
  let isMusicEnabled = true;
  let isEmojiEnabled = true;

  // 20 Verified Mythical & Scenery Backgrounds
  const BACKGROUND_THEMES = {
    glacier: { url: '/backgrounds/glacier.jpg', theme: 'paper' },
    dragon: { url: '/backgrounds/dragon.jpg', theme: 'sunset' },
    phoenix: { url: '/backgrounds/phoenix.jpg', theme: 'sunset' },
    griffin: { url: '/backgrounds/griffin.jpg', theme: 'paper' },
    leviathan: { url: '/backgrounds/leviathan.jpg', theme: 'dark' },
    pegasus: { url: '/backgrounds/pegasus.jpg', theme: 'paper' },
    kraken: { url: '/backgrounds/kraken.jpg', theme: 'dark' },
    hydra: { url: '/backgrounds/hydra.jpg', theme: 'emerald' },
    cerberus: { url: '/backgrounds/cerberus.jpg', theme: 'dark' },
    kitsune: { url: '/backgrounds/kitsune.jpg', theme: 'neon' },
    basilisk: { url: '/backgrounds/basilisk.jpg', theme: 'emerald' },
    chimera: { url: '/backgrounds/chimera.jpg', theme: 'sunset' },
    fenrir: { url: '/backgrounds/fenrir.jpg', theme: 'neon' },
    roc: { url: '/backgrounds/roc.jpg', theme: 'paper' },
    banshee: { url: '/backgrounds/banshee.jpg', theme: 'dark' },
    sphinx: { url: '/backgrounds/sphinx.jpg', theme: 'sunset' },
    behemoth: { url: '/backgrounds/behemoth.jpg', theme: 'emerald' },
    thunderbird: { url: '/backgrounds/thunderbird.jpg', theme: 'neon' },
    manticore: { url: '/backgrounds/manticore.jpg', theme: 'sunset' },
    qilin: { url: '/backgrounds/qilin.jpg', theme: 'emerald' },
    wyvern: { url: '/backgrounds/wyvern.jpg', theme: 'dark' }
  };

  // Mystical Celtic/Fantasy Instrumental Harp & Ambient Strings
  const bgAudio = new Audio('https://cdn.pixabay.com/download/audio/2022/11/06/audio_2c2d28f73b.mp3');
  bgAudio.loop = true;
  bgAudio.volume = 0.22;

  let hasUserInteracted = false;
  function triggerAudioUnlock() {
    if (hasUserInteracted) return;
    hasUserInteracted = true;
    getAudioContext();
    if (isMusicEnabled) {
      bgAudio.play().catch(() => {});
    }
    window.removeEventListener('click', triggerAudioUnlock);
    window.removeEventListener('keydown', triggerAudioUnlock);
    window.removeEventListener('touchstart', triggerAudioUnlock);
  }
  window.addEventListener('click', triggerAudioUnlock);
  window.addEventListener('keydown', triggerAudioUnlock);
  window.addEventListener('touchstart', triggerAudioUnlock);

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

  const authPasswordInput = document.getElementById('auth-password');
  const togglePasswordVisibilityBtn = document.getElementById('toggle-password-visibility');

  const openProfileBtn = document.getElementById('open-profile-btn');
  const profileModal = document.getElementById('profile-modal');
  const profileCloseX = document.getElementById('profile-close-x');
  const profUsername = document.getElementById('prof-username');
  const profRole = document.getElementById('prof-role');
  const profPvpWinRate = document.getElementById('prof-pvp-winrate');
  const profPvpWon = document.getElementById('prof-pvp-won');
  const profPvpPlayed = document.getElementById('prof-pvp-played');
  const profBotWinRate = document.getElementById('prof-bot-winrate');
  const profBotWon = document.getElementById('prof-bot-won');
  const profBotPlayed = document.getElementById('prof-bot-played');
  const profTotalScore = document.getElementById('prof-total-score');
  const profFriendsCount = document.getElementById('prof-friends-count');
  const profMemberSince = document.getElementById('prof-member-since');
  const deleteMyAccountBtn = document.getElementById('delete-my-account-btn');

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

  const privacyModal = document.getElementById('privacy-modal');
  const privacyCloseX = document.getElementById('privacy-close-x');
  const privacyAcceptBtn = document.getElementById('privacy-accept-btn');

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

  const chatDrawer = document.getElementById('chat-drawer');
  const chatToggleBtn = document.getElementById('chat-toggle-btn');
  const chatCloseBtn = document.getElementById('chat-close-btn');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');

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

  // Return to Lobby button inside winner modal
  const returnLobbyBtn = winnerModal?.querySelector('button.full-width');
  if (returnLobbyBtn) {
    returnLobbyBtn.removeAttribute('onclick');
    returnLobbyBtn.addEventListener('click', returnToLobby);
  }

  function returnToLobby() {
    winnerModal?.classList.add('hidden');
    gameView?.classList.add('hidden');
    gameView?.classList.remove('game-locked');
    lobbyView?.classList.remove('hidden');
    chatDrawer?.classList.add('hidden');
    eliminatedBanner?.classList.add('hidden');

    currentRoomCode = null;
    isEliminated = false;
    isCompleted = false;
    isAbandoned = false;
    selectedCell = null;

    if (roomStatus) roomStatus.textContent = '';
    if (lobbyRoster) lobbyRoster.textContent = '';
    if (gridContainer) gridContainer.innerHTML = '';
    if (quitBtn) quitBtn.disabled = false;

    // Refresh user's top bar stats
    if (currentUser) {
      fetch(`/api/user/profile/${encodeURIComponent(currentUser.username)}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.profile) {
            currentUser.pvpWon = data.profile.pvpWon;
            currentUser.pvpPlayed = data.profile.pvpPlayed;
            currentUser.botWon = data.profile.botWon;
            currentUser.botPlayed = data.profile.botPlayed;
            localStorage.setItem('sudoku_active_user', JSON.stringify(currentUser));
            updateAuthUI();
          }
        })
        .catch(() => {});
    }
  }

  // Live Chat
  chatToggleBtn?.addEventListener('click', () => {
    chatDrawer?.classList.toggle('hidden');
    if (!chatDrawer?.classList.contains('hidden')) chatInput?.focus();
  });
  chatCloseBtn?.addEventListener('click', () => chatDrawer?.classList.add('hidden'));

  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput?.value.trim();
    if (!text || !currentRoomCode) return;
    socket.emit('sendChatMessage', { roomCode: currentRoomCode, text });
    chatInput.value = '';
  });

  socket.on('newChatMessage', ({ sender, senderId, text, timestamp }) => {
    if (!chatMessages) return;
    const isMe = senderId === myId;
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    const localTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${isMe ? 'my-msg' : ''}`;
    msgDiv.innerHTML = `
      <div class="chat-meta">
        <strong>${sender} ${isMe ? '(You)' : ''}</strong>
        <span>${localTime}</span>
      </div>
      <div>${text}</div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!isMe && isSoundEnabled) playTone(620, 'sine', 0.08, 0.04);
  });

  togglePasswordVisibilityBtn?.addEventListener('click', () => {
    if (!authPasswordInput) return;
    const isPass = authPasswordInput.type === 'password';
    authPasswordInput.type = isPass ? 'text' : 'password';
    togglePasswordVisibilityBtn.textContent = isPass ? '🙈' : '👁️';
  });

  // Settings
  function saveGameSettings() {
    const settings = {
      difficultyLevel: activeDifficultyLevel,
      symbolSet: activeSymbolSet,
      background: bgSelect?.value || 'dragon',
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

  difficultySlider?.addEventListener('input', (e) => {
    activeDifficultyLevel = parseInt(e.target.value, 10);
    const label = DIFFICULTY_TIERS[activeDifficultyLevel];
    if (sliderLevelName) sliderLevelName.textContent = label;
    if (activeDiffLabel) activeDiffLabel.textContent = label.split(' (')[0];
    saveGameSettings();
  });

  symbolSetSelect?.addEventListener('change', (e) => {
    activeSymbolSet = e.target.value;
    if (activeSymbolLabel) activeSymbolLabel.textContent = symbolSetSelect.options[symbolSetSelect.selectedIndex].text;
    saveGameSettings();
  });

  bgSelect?.addEventListener('change', (e) => {
    const config = BACKGROUND_THEMES[e.target.value];
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

  settingsOpenBtn?.addEventListener('click', () => settingsModal?.classList.remove('hidden'));
  const closeSettings = () => settingsModal?.classList.add('hidden');
  settingsCloseX?.addEventListener('click', closeSettings);
  settingsSaveBtn?.addEventListener('click', () => {
    saveGameSettings();
    closeSettings();
  });

  adminOpenBtn?.addEventListener('click', () => {
    settingsModal?.classList.add('hidden');
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
        tr.innerHTML = `
          <td><strong>${u.username}</strong></td>
          <td><span class="role-badge ${u.role}">${u.role.toUpperCase()}</span></td>
          <td>${u.pvpWon || 0}W / ${u.pvpPlayed || 0}P</td>
          <td>${u.botWon || 0}W / ${u.botPlayed || 0}P</td>
          <td>${new Date(u.registeredAt).toLocaleDateString()}</td>
          <td><button class="btn danger-small sketch-border" onclick="adminDeleteUser('${u.username}')">Delete</button></td>
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

  window.adminDeleteUser = async function(targetUsername) {
    const key = adminSecretInput.value.trim();
    if (!key || !confirm(`Permanently erase user "${targetUsername}"?`)) return;

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: key, targetUsername })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchAdminUsers(key);
      } else alert(data.error || 'Failed to delete user.');
    } catch (err) {
      alert('Error communicating with server.');
    }
  };

  openRegisterBtn?.addEventListener('click', () => privacyModal?.classList.remove('hidden'));
  privacyCloseX?.addEventListener('click', () => privacyModal?.classList.add('hidden'));
  privacyAcceptBtn?.addEventListener('click', () => {
    privacyModal?.classList.add('hidden');
    openAuth(true);
  });

  function updateAuthUI() {
    if (currentUser) {
      guestAuthControls.classList.add('hidden');
      loggedAuthControls.classList.remove('hidden');
      loggedUsernameSpan.textContent = currentUser.username;
      userStatsSpan.textContent = `PvP: ${currentUser.pvpWon || 0}W/${currentUser.pvpPlayed || 0}P | Bot: ${currentUser.botWon || 0}W/${currentUser.botPlayed || 0}P`;
      if (usernameInput) usernameInput.value = currentUser.username;
    } else {
      guestAuthControls.classList.remove('hidden');
      loggedAuthControls.classList.add('hidden');
    }
  }

  async function loadPersistedUser() {
    const saved = localStorage.getItem('sudoku_active_user');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        updateAuthUI();
        socket.emit('registerOnlineUser', { username: currentUser.username });

        const res = await fetch(`/api/user/profile/${encodeURIComponent(currentUser.username)}`);
        const data = await res.json();
        if (data.success && data.profile) {
          currentUser.pvpWon = data.profile.pvpWon;
          currentUser.pvpPlayed = data.profile.pvpPlayed;
          currentUser.botWon = data.profile.botWon;
          currentUser.botPlayed = data.profile.botPlayed;
          localStorage.setItem('sudoku_active_user', JSON.stringify(currentUser));
          updateAuthUI();
        }
      } catch (e) {
        currentUser = null;
      }
    }
  }

  openProfileBtn?.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/user/profile/${encodeURIComponent(currentUser.username)}`);
      const data = await res.json();
      if (!data.success) return alert(data.error || 'Failed to load profile.');

      const p = data.profile;
      profUsername.textContent = p.username;
      profRole.textContent = p.role.toUpperCase();
      profPvpWinRate.textContent = p.pvpWinRate;
      profPvpWon.textContent = p.pvpWon;
      profPvpPlayed.textContent = p.pvpPlayed;
      profBotWinRate.textContent = p.botWinRate;
      profBotWon.textContent = p.botWon;
      profBotPlayed.textContent = p.botPlayed;
      profTotalScore.textContent = p.totalScore;
      profFriendsCount.textContent = p.friendsCount;
      profMemberSince.textContent = new Date(p.registeredAt).toLocaleDateString([], { month: 'short', year: 'numeric' });

      profileModal?.classList.remove('hidden');
    } catch (err) {
      alert('Could not retrieve player profile.');
    }
  });
  profileCloseX?.addEventListener('click', () => profileModal?.classList.add('hidden'));

  deleteMyAccountBtn?.addEventListener('click', async () => {
    if (!currentUser || !confirm('Permanently delete your account, game stats, and friendships? This cannot be undone.')) return;
    const pass = prompt('Enter password to confirm deletion:');
    if (!pass) return;

    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, password: pass })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        localStorage.removeItem('sudoku_active_user');
        currentUser = null;
        location.reload();
      } else alert(data.error || 'Failed to delete account.');
    } catch (err) {
      alert('Connection error.');
    }
  });

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
            <td><button class="btn danger-small sketch-border" onclick="removeFriend('${f.username}')">Remove</button></td>
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

  window.removeFriend = async function(targetFriend) {
    if (!currentUser || !confirm(`Remove ${targetFriend} from friends?`)) return;
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, targetFriend })
      });
      const data = await res.json();
      if (data.success) refreshFriendsList();
      else alert(data.error || 'Failed to remove friend.');
    } catch (e) {
      alert('Network error.');
    }
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
    alert(`👥 Friend request from ${from}!`);
    refreshFriendsList();
  });
  socket.on('friendStatusChanged', () => refreshFriendsList());

  let isRegisterMode = false;
  function openAuth(isRegister) {
    isRegisterMode = isRegister;
    authErrorMsg.classList.add('hidden');
    authUsernameInput.value = '';
    authPasswordInput.value = '';
    authPasswordInput.type = 'password';
    if (togglePasswordVisibilityBtn) togglePasswordVisibilityBtn.textContent = '👁️';

    authModalTitle.textContent = isRegisterMode ? '📝 Register Player' : '🔑 Player Login';
    authSubmitBtn.textContent = isRegisterMode ? 'Create Account' : 'Log In';
    authSwitchMsg.textContent = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
    authToggleLink.textContent = isRegisterMode ? 'Log In here' : 'Register here';
    authModal.classList.remove('hidden');
  }

  openLoginBtn?.addEventListener('click', () => openAuth(false));
  authCloseX?.addEventListener('click', () => authModal.classList.add('hidden'));

  authToggleLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isRegisterMode) {
      authModal.classList.add('hidden');
      privacyModal?.classList.remove('hidden');
    } else openAuth(false);
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
          tr.innerHTML = `
            <td>${new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
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

  // Glitter Canvas
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

  // Audio synthesis
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
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);
      gain.gain.setValueAtTime(0.001, now + idx * 0.16);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.16 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.52);
    });
  }

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
      socket.emit('createSoloBotRoom', { 
        username, 
        difficultyLevel: activeDifficultyLevel, 
        botSpeed: botSpeedSelect?.value || 'medium', 
        durationMinutes, 
        symbolSet: activeSymbolSet 
      });
    } else {
      socket.emit('createRoom', { 
        username, 
        difficultyLevel: activeDifficultyLevel, 
        maxPlayers: maxPlayersSelect?.value || 2, 
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
    if (!roomCode) return alert('Please enter room code');
    socket.emit('joinRoom', { roomCode, username });
  });

  // Quit / Resign handler
  quitBtn?.addEventListener('click', () => {
    if (confirm('Are you sure you want to resign and abandon this match? You will be ranked last.')) {
      socket.emit('quitGame', { roomCode: currentRoomCode });
      isAbandoned = true;
      isEliminated = true;
      if (quitBtn) quitBtn.disabled = true;
      if (eliminatedBanner) {
        eliminatedBanner.textContent = '🏳️ You abandoned the match. Ranked last as DNF.';
        eliminatedBanner.classList.remove('hidden');
      }
    }
  });

  socket.on('roomCreated', ({ roomCode, maxPlayers, difficultyLevel }) => {
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

  socket.on('playerAnnouncement', ({ message }) => {
    const banner = document.createElement('div');
    banner.className = 'player-announcement sketch-border';
    banner.textContent = message;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4000);
  });

  socket.on('startGame', ({ puzzle, players, totalBlanks, duration, symbolSet, roomCode }) => {
    isEliminated = false;
    isCompleted = false;
    isAbandoned = false;
    selectedCell = null;
    activeSymbolSet = symbolSet || 'numbers';
    currentRoomCode = roomCode || currentRoomCode;
    completedRows.clear();
    completedCols.clear();
    completedBoxes.clear();

    if (resultFlashScreen) resultFlashScreen.className = 'result-flash-screen';
    if (chatMessages) chatMessages.innerHTML = '';
    chatDrawer?.classList.add('hidden');

    lobbyView?.classList.add('hidden');
    gameView?.classList.remove('hidden', 'game-locked');
    eliminatedBanner?.classList.add('hidden');
    winnerModal?.classList.add('hidden');
    if (currentRoomSpan) currentRoomSpan.textContent = currentRoomCode;
    if (quitBtn) quitBtn.disabled = false;

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
            if (isEliminated || isCompleted || isAbandoned || cell.classList.contains('correct')) return;
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
        if (isEliminated || isCompleted || isAbandoned || !selectedCell) return;
        makeMove(parseInt(selectedCell.dataset.row, 10), parseInt(selectedCell.dataset.col, 10), val);
      });

      symbolPad.appendChild(btn);
    });
    updateExhaustedSymbols();
  }

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === chatInput) return;
    if (isEliminated || isCompleted || isAbandoned || !selectedCell) return;
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
        isEliminated = true;
        if (quitBtn) quitBtn.disabled = true;
        if (eliminatedBanner) {
          eliminatedBanner.textContent = '❌ You were eliminated (3 mistakes)!';
          eliminatedBanner.classList.remove('hidden');
        }
      }

      setTimeout(() => {
        cell.classList.remove('wrong');
        cell.textContent = '';
      }, 500);
    }
  });

  function checkCompletions() {
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
        }
      }
    }
  }

  function isCellSolved(cell) {
    return cell && (cell.classList.contains('prefilled') || cell.classList.contains('correct'));
  }

  function animateCompletedSection(cells, emojiSet) {
    playSectionCompleteSound();
    cells.forEach((cell, idx) => {
      setTimeout(() => {
        cell.classList.add('completed-flash');
        if (idx === 4) spawnFloatingEmoji(cell, emojiSet);
        setTimeout(() => cell.classList.remove('completed-flash'), 1000);
      }, idx * 35);
    });
  }

  socket.on('progressUpdate', ({ playerId, score, mistakes, eliminated, completed, abandoned, totalBlanks }) => {
    const bar = document.getElementById(`bar-${playerId}`);
    const scoreSpan = document.getElementById(`score-${playerId}`);
    const mistakesSpan = document.getElementById(`mistakes-${playerId}`);
    const card = document.getElementById(`card-${playerId}`);

    if (bar && scoreSpan && mistakesSpan) {
      const pct = Math.min(100, Math.round((score / totalBlanks) * 100));
      bar.style.width = `${pct}%`;
      scoreSpan.textContent = completed ? '🏁 FINISHED' : `${score} / ${totalBlanks}`;

      if (abandoned) mistakesSpan.textContent = '🏳️ DNF';
      else if (eliminated) mistakesSpan.textContent = '💀 OUT';
      else mistakesSpan.textContent = `❤️ ${Math.max(0, 3 - mistakes)}`;

      if (card) {
        if (completed) card.classList.add('completed');
        if (eliminated || abandoned) card.classList.add('eliminated');
      }
    }
  });

  // When this individual player personally finishes their board
  socket.on('playerPersonalFinished', ({ rank }) => {
    isCompleted = true;
    playDramaticVictory();
    if (eliminatedBanner) {
      eliminatedBanner.textContent = `🎉 You completed the board! Rank: #${rank}. Waiting for others or return to lobby.`;
      eliminatedBanner.classList.remove('hidden');
    }
  });

  // When the whole match finishes (all done or timer expired)
  socket.on('matchEndedFinal', ({ reason, leaderboard }) => {
    gameView?.classList.add('game-locked');
    if (quitBtn) quitBtn.disabled = true;

    if (winnerTitle) winnerTitle.textContent = '🏁 Match Finished';
    if (winnerReason) winnerReason.textContent = reason;

    if (leaderboardBody) {
      leaderboardBody.innerHTML = '';
      leaderboard.forEach((player, idx) => {
        const tr = document.createElement('tr');
        const medal = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `;
        const statusText = player.abandoned 
          ? '🏳️ Abandoned (Last)' 
          : player.completed 
            ? '🏁 Finished' 
            : player.eliminated 
              ? '💀 Struck Out' 
              : '⏳ Incomplete';

        tr.innerHTML = `
          <td>${medal}</td>
          <td>${player.name} ${player.id === myId ? '(You)' : ''}</td>
          <td>${player.score}</td>
          <td>${player.mistakes}/3</td>
          <td>${statusText}</td>
        `;
        leaderboardBody.appendChild(tr);
      });
    }

    winnerModal?.classList.remove('hidden');
  });
});