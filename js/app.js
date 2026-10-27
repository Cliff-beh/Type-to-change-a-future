/**
 * Main Application Logic for Type to change a future
 * Team: Beyond the Ordinary
 * Campaign: Type to change a future
 * Instagram / TikTok: @type4future
 */
(function() {
  'use strict';

  // --- Campaign Constants ---
  const CAMPAIGN = {
    name: 'Type to change a future',
    team: 'Beyond the Ordinary',
    instagram: 'type4future',
    tiktok: 'type4future',
    storageKeyLeaderboard: 'type4future_leaderboard_v3',
    storageKeyNicknames: 'type4future_registered_nicknames_v3',
    storageKeyCurrentPlayer: 'type4future_current_player_v3'
  };

  // Only truly registered players who finished the challenge appear
  const SEED_LEADERBOARD = [];

  // --- State Variables ---
  let leaderboard = [];
  let registeredNicknames = new Set();
  let currentPlayer = {
    nickname: '',
    avatar: '🚀',
    level: 'challenger',
    ig: '',
    donated: false
  };

  // Typing Game State
  let isCountingDown = false;
  let testActive = false;
  let testFinished = false;
  let currentPassage = null;
  let currentPassageIndex = 0;
  let timerInterval = null;
  let timeRemaining = 45;
  let timeElapsed = 0;
  let correctKeystrokes = 0;
  let totalKeystrokes = 0;
  let errorCount = 0;
  let calculatedWpm = 0;
  let calculatedAccuracy = 100;
  let challengeInfo = null;

  // --- Initialization ---
  document.addEventListener('DOMContentLoaded', () => {
    initStorage();
    parseUrlParams();
    initUI();
    initNicknameValidation();
    initTypingEngine();
    initLeaderboard();
    initQRCodes();
    initSocialSharing();
    initPledgeModal();
  });

  // --- Storage & Database Sync Management ---
  async function fetchLeaderboardFromDB() {
    try {
      const res = await fetch('/api/leaderboard?t=' + Date.now());
      if (res.ok) {
        const dbData = await res.json();
        if (Array.isArray(dbData)) {
          // Keep only true players (filter out any old seed items with sb- prefix)
          leaderboard = dbData.filter(item => item && !String(item.id || '').startsWith('sb-'));
          registeredNicknames = new Set();
          leaderboard.forEach(item => {
            if (item.nickname) registeredNicknames.add(item.nickname.trim().toLowerCase());
          });
          renderLeaderboard(getActiveFilter());
          updateLiveRankTracking(calculatedWpm, calculatedAccuracy);
          updateSyncBadge(true, leaderboard.length);
          saveLeaderboard();
          return;
        }
      }
    } catch (e) {
      console.warn('API sync fallback to localStorage', e);
      updateSyncBadge(false, leaderboard.length);
    }
  }

  function updateSyncBadge(isLive, count) {
    const label = document.getElementById('db-sync-label');
    const stats = document.getElementById('db-sync-stats');
    if (label) {
      label.textContent = isLive ? '⚡ Live SQLite Sync: Active' : '💾 Offline Mode (Local)';
      label.style.color = isLive ? '#10b981' : '#f59e0b';
    }
    if (stats) {
      stats.textContent = `${count} real typist${count === 1 ? '' : 's'} registered`;
    }
  }

  function initStorage() {
    try {
      const storedLeaderboard = localStorage.getItem(CAMPAIGN.storageKeyLeaderboard);
      if (storedLeaderboard) {
        const parsed = JSON.parse(storedLeaderboard);
        // Purge any legacy fake accounts from localStorage
        leaderboard = parsed.filter(item => item && !String(item.id || '').startsWith('sb-'));
      } else {
        leaderboard = [];
      }

      registeredNicknames = new Set();
      leaderboard.forEach(item => {
        if (item.nickname) registeredNicknames.add(item.nickname.trim().toLowerCase());
      });

      const storedNicknames = localStorage.getItem(CAMPAIGN.storageKeyNicknames);
      if (storedNicknames) {
        JSON.parse(storedNicknames).forEach(n => {
          if (n && !['cyberflash', 'aisha_types', 'neonrunner', 'marcus_kl', 'joymaker', 'speedypenguin', 'futurecoderx', 'hopetypist'].includes(n.toLowerCase())) {
            registeredNicknames.add(n.toLowerCase());
          }
        });
      }

      const storedPlayer = localStorage.getItem(CAMPAIGN.storageKeyCurrentPlayer);
      if (storedPlayer) {
        const parsed = JSON.parse(storedPlayer);
        currentPlayer = { ...currentPlayer, ...parsed };
      }
    } catch (e) {
      console.warn('Storage fallback', e);
      leaderboard = [];
    }

    // Immediately fetch from database backend
    fetchLeaderboardFromDB();
  }

  function saveLeaderboard() {
    try {
      localStorage.setItem(CAMPAIGN.storageKeyLeaderboard, JSON.stringify(leaderboard));
      localStorage.setItem(CAMPAIGN.storageKeyNicknames, JSON.stringify(Array.from(registeredNicknames)));
      localStorage.setItem(CAMPAIGN.storageKeyCurrentPlayer, JSON.stringify(currentPlayer));
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }

  // --- URL Parameter Parsing ---
  function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const challenger = urlParams.get('challenger');
    const challengerWpm = urlParams.get('wpm');

    if (challenger && challengerWpm) {
      challengeInfo = {
        name: challenger,
        wpm: parseInt(challengerWpm, 10) || 50
      };
      showChallengeBanner(challengeInfo);
    }
  }

  function showChallengeBanner(info) {
    const banner = document.getElementById('challenge-banner');
    if (!banner) return;
    const nameEl = document.getElementById('challenge-banner-name');
    const wpmEl = document.getElementById('challenge-banner-wpm');
    if (nameEl) nameEl.textContent = info.name;
    if (wpmEl) wpmEl.textContent = info.wpm;
    banner.classList.remove('hidden');
  }

  // --- UI Elements and Navigation ---
  function initUI() {
    updateCampaignProgress();
    updatePlayerStatusChip();

    // Mute button
    const muteBtn = document.getElementById('audio-toggle-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const muted = CharityAudio.toggleMute();
        muteBtn.textContent = muted ? '🔇 Sound Off' : '🔊 Sound On';
        muteBtn.classList.toggle('muted', muted);
      });
    }

    // Hero "Start Typing Challenge" button
    const heroStartBtn = document.getElementById('hero-start-btn');
    if (heroStartBtn) {
      heroStartBtn.addEventListener('click', () => {
        handleStartChallengeAction(false, true);
      });
    }

    // Player Status Chip Click
    const chipTrigger = document.getElementById('player-status-trigger');
    if (chipTrigger) {
      chipTrigger.addEventListener('click', () => {
        openNicknameModal();
      });
    }

    // Avatar Selection inside Nickname Popup
    const avatarBtns = document.querySelectorAll('.avatar-option');
    avatarBtns.forEach(btn => {
      if (btn.dataset.avatar === currentPlayer.avatar) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        avatarBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlayer.avatar = btn.dataset.avatar;
        updatePlayerStatusChip();
        saveLeaderboard();
      });
    });

    // Level Selection Buttons in Arena Controls Bar
    const levelBtns = document.querySelectorAll('.arena-level-btn');
    levelBtns.forEach(btn => {
      if (btn.dataset.level === currentPlayer.level) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        setLevel(btn.dataset.level);
      });
    });

    // Level Selection inside Nickname Popup
    const popupLevelBtns = document.querySelectorAll('.popup-level-btn');
    popupLevelBtns.forEach(btn => {
      if (btn.dataset.level === currentPlayer.level) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        popupLevelBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlayer.level = btn.dataset.level;
        syncLevelUI(btn.dataset.level);
      });
    });
  }

  function setLevel(lvl) {
    currentPlayer.level = lvl;
    syncLevelUI(lvl);
    saveLeaderboard();
    loadPassage();
    resetTypingTest();
  }

  function syncLevelUI(lvl) {
    document.querySelectorAll('.arena-level-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.level === lvl);
    });
    document.querySelectorAll('.popup-level-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.level === lvl);
    });
  }

  function updatePlayerStatusChip() {
    const chip = document.getElementById('player-status-trigger');
    const avatarEl = document.getElementById('player-chip-avatar');
    const textEl = document.getElementById('player-chip-text');
    if (!chip || !avatarEl || !textEl) return;

    if (currentPlayer.nickname && currentPlayer.nickname.trim() !== '') {
      chip.className = 'player-status-chip assigned';
      avatarEl.textContent = currentPlayer.avatar || '🚀';
      textEl.textContent = `Typing as: ${currentPlayer.nickname} (${capitalize(currentPlayer.level)})`;
    } else {
      chip.className = 'player-status-chip unassigned';
      avatarEl.textContent = '👤';
      textEl.textContent = 'Guest Typist (Click or touch to set nickname)';
    }
  }

  function updateCampaignProgress() {
    const raisedEl = document.getElementById('stat-raised-amount');
    const percentEl = document.getElementById('stat-raised-percent');
    const progressBar = document.getElementById('campaign-progress-bar');
    const donorCountEl = document.getElementById('stat-donor-count');

    const totalDonors = leaderboard.filter(item => item.donated).length + 42;
    const percent = Math.min(100, Math.round((CAMPAIGN.currentRaised / CAMPAIGN.targetAmount) * 100));

    if (raisedEl) raisedEl.textContent = `RM ${CAMPAIGN.currentRaised.toLocaleString()}`;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (donorCountEl) donorCountEl.textContent = `${totalDonors}+`;
  }

  // --- Nickname Validation & Popup Flow ---
  function openNicknameModal() {
    const input = document.getElementById('player-nickname-input');
    const igInput = document.getElementById('player-ig-input');

    if (input) {
      input.value = currentPlayer.nickname || '';
      validateNickname(input.value.trim());
    }
    if (igInput) {
      igInput.value = currentPlayer.ig || '';
    }

    // Sync level in popup
    syncLevelUI(currentPlayer.level);

    openModal('nickname-prompt-modal');
    // Only auto-focus on desktop; on mobile phone, programmatic focus causes unwanted screen scroll
    if (window.innerWidth > 768) {
      setTimeout(() => {
        if (input) input.focus({ preventScroll: true });
      }, 150);
    }
  }

  function initNicknameValidation() {
    const nicknameInput = document.getElementById('player-nickname-input');
    const igInput = document.getElementById('player-ig-input');
    const confirmBtn = document.getElementById('confirm-nickname-btn');

    if (!nicknameInput) return;

    nicknameInput.addEventListener('input', () => {
      const val = nicknameInput.value.trim();
      validateNickname(val);
    });

    if (igInput) {
      igInput.addEventListener('input', () => {
        currentPlayer.ig = igInput.value.trim().replace(/^@/, '');
        saveLeaderboard();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const val = nicknameInput.value.trim();
        if (validateNickname(val)) {
          registeredNicknames.add(val.toLowerCase());
          currentPlayer.nickname = val;
          saveLeaderboard();
          updatePlayerStatusChip();
          closeModal('nickname-prompt-modal');

          // Never auto-scroll on mobile phone to avoid jarring viewport jump
          const isMobileDevice = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          if (!isMobileDevice) {
            const arena = document.getElementById('typing-arena');
            if (arena) arena.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }
  }

  function validateNickname(val) {
    const feedback = document.getElementById('nickname-feedback');
    const confirmBtn = document.getElementById('confirm-nickname-btn');
    if (!feedback) return false;

    if (!val) {
      feedback.className = 'nickname-feedback default';
      feedback.textContent = 'Nickname must be 3-15 characters and unique.';
      if (confirmBtn) confirmBtn.disabled = true;
      return false;
    }

    if (val.length < 3) {
      feedback.className = 'nickname-feedback warning';
      feedback.textContent = 'Too short! At least 3 characters needed.';
      if (confirmBtn) confirmBtn.disabled = true;
      return false;
    }

    if (val.length > 15) {
      feedback.className = 'nickname-feedback warning';
      feedback.textContent = 'Too long! Max 15 characters.';
      if (confirmBtn) confirmBtn.disabled = true;
      return false;
    }

    const lower = val.toLowerCase();
    const isCurrentUsersName = (currentPlayer.nickname && currentPlayer.nickname.toLowerCase() === lower);
    const isTaken = registeredNicknames.has(lower) && !isCurrentUsersName;

    if (isTaken) {
      feedback.className = 'nickname-feedback error';
      feedback.innerHTML = `⚠️ <strong>"${val}"</strong> is already taken on the leaderboard. Choose another!`;
      if (confirmBtn) confirmBtn.disabled = true;
      return false;
    } else {
      feedback.className = 'nickname-feedback success';
      feedback.innerHTML = `✓ <strong>"${val}"</strong> is available! Ready to battle.`;
      if (confirmBtn) confirmBtn.disabled = false;
      return true;
    }
  }

  function hasNickname() {
    return currentPlayer.nickname && currentPlayer.nickname.trim().length >= 3;
  }

  function handleStartChallengeAction(autoStart = true, fromHero = false) {
    if (!hasNickname()) {
      openNicknameModal();
    } else {
      const isMobileDevice = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (fromHero && !isMobileDevice) {
        const arena = document.getElementById('typing-arena');
        if (arena) arena.scrollIntoView({ behavior: 'smooth' });
      }
      if (autoStart) {
        triggerCountdown();
      }
    }
  }

  // --- Countdown Engine (3, 2, 1, START!) ---
  function triggerCountdown() {
    if (isCountingDown || testActive) return;
    isCountingDown = true;

    // Reset previous typing state
    resetTypingTest(false);

    const overlay = document.getElementById('countdown-overlay');
    const textEl = document.getElementById('countdown-text');
    const startContainer = document.getElementById('arena-start-container');

    if (startContainer) startContainer.style.display = 'none';
    if (!overlay || !textEl) {
      isCountingDown = false;
      startTypingTest();
      return;
    }

    overlay.classList.remove('hidden');
    CharityAudio.init();

    let count = 3;
    textEl.textContent = count;
    CharityAudio.playCountdownBeep(false);

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        textEl.textContent = count;
        CharityAudio.playCountdownBeep(false);
      } else if (count === 0) {
        textEl.textContent = 'START! 🔥';
        CharityAudio.playCountdownBeep(true);
      } else {
        clearInterval(timer);
        overlay.classList.add('hidden');
        isCountingDown = false;
        startTypingTest();
      }
    }, 800);
  }

  // --- Typing Engine ---
  function initTypingEngine() {
    const inputField = document.getElementById('typing-hidden-input');
    const arenaCard = document.getElementById('typing-arena-card');
    const passageBox = document.getElementById('typing-passage-display');
    const arenaStartBtn = document.getElementById('arena-start-btn');
    const restartBtn = document.getElementById('typing-restart-btn');
    const changePassageBtn = document.getElementById('change-passage-btn');

    loadPassage();

    // Arena Start Button click
    if (arenaStartBtn) {
      arenaStartBtn.addEventListener('click', () => {
        handleStartChallengeAction();
      });
    }

    // Touching the arena triggers nickname if unassigned, or focuses if test is active
    if (arenaCard) {
      arenaCard.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (!hasNickname()) {
          openNicknameModal();
        } else if (!testActive && !isCountingDown) {
          triggerCountdown();
        } else if (testActive && inputField) {
          inputField.focus({ preventScroll: true });
        }
      });
    }

    if (passageBox) {
      passageBox.addEventListener('click', () => {
        if (!hasNickname()) {
          openNicknameModal();
        } else if (!testActive && !isCountingDown) {
          triggerCountdown();
        } else if (testActive && inputField) {
          inputField.focus({ preventScroll: true });
        }
      });
    }

    if (inputField) {
      inputField.addEventListener('input', handleTypingInput);
      inputField.addEventListener('keydown', handleTypingKeydown);
    }

    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        resetTypingTest(true);
      });
    }

    if (changePassageBtn) {
      changePassageBtn.addEventListener('click', () => {
        cyclePassage();
        resetTypingTest(true);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && testActive) {
        resetTypingTest(true);
      }
    });
  }

  function loadPassage() {
    const level = currentPlayer.level || 'challenger';
    const list = window.CAMPAIGN_PASSAGES ? window.CAMPAIGN_PASSAGES[level] : null;

    if (!list || list.length === 0) {
      currentPassage = {
        title: 'Type to change a future',
        timeLimit: 45,
        text: 'Type. Score. Challenge. Repeat. We are racing to give underserved children equal footing in education, technology, and economic dignity.'
      };
    } else {
      currentPassage = list[currentPassageIndex % list.length];
    }

    timeRemaining = currentPassage.timeLimit;
    timeElapsed = 0;

    const titleEl = document.getElementById('passage-theme-title');
    const timerEl = document.getElementById('typing-live-timer');
    if (titleEl) titleEl.textContent = `${capitalize(level)}: "${currentPassage.title}"`;
    if (timerEl) timerEl.textContent = `${timeRemaining}s`;

    renderPassageCharacters(currentPassage.text);
    updateLiveMetrics(0, 100);
  }

  function cyclePassage() {
    const level = currentPlayer.level || 'challenger';
    const list = window.CAMPAIGN_PASSAGES ? window.CAMPAIGN_PASSAGES[level] : [];
    if (list.length > 0) {
      currentPassageIndex = (currentPassageIndex + 1) % list.length;
    }
  }

  function renderPassageCharacters(text) {
    const displayEl = document.getElementById('typing-passage-display');
    if (!displayEl) return;
    displayEl.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement('span');
      span.textContent = text[i];
      span.className = 'char pending';
      span.dataset.index = i;
      if (i === 0) span.classList.add('caret');
      fragment.appendChild(span);
    }
    displayEl.appendChild(fragment);
  }

  function handleTypingInput(e) {
    if (!hasNickname()) {
      e.target.value = '';
      openNicknameModal();
      return;
    }

    if (!testActive || testFinished) return;

    const inputField = e.target;
    const typedText = inputField.value;
    const passageText = currentPassage.text;
    const charSpans = document.querySelectorAll('#typing-passage-display .char');

    totalKeystrokes++;

    let correctCount = 0;
    let errors = 0;

    for (let i = 0; i < passageText.length; i++) {
      const span = charSpans[i];
      if (!span) continue;

      span.classList.remove('caret', 'correct', 'incorrect', 'pending');

      if (i < typedText.length) {
        if (typedText[i] === passageText[i]) {
          span.classList.add('correct');
          correctCount++;
        } else {
          span.classList.add('incorrect');
          errors++;
        }
      } else {
        span.classList.add('pending');
      }

      if (i === typedText.length) {
        span.classList.add('caret');
      }
    }

    correctKeystrokes = correctCount;
    errorCount = errors;

    const lastCharIndex = typedText.length - 1;
    if (lastCharIndex >= 0) {
      if (typedText[lastCharIndex] === passageText[lastCharIndex]) {
        CharityAudio.playKeyClick();
      } else {
        CharityAudio.playKeyError();
      }
    }

    calculateMetrics();

    if (typedText.length >= passageText.length) {
      finishTypingTest(true);
    }
  }

  function handleTypingKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      resetTypingTest(true);
    }
  }

  function startTypingTest() {
    testActive = true;
    testFinished = false;
    timeElapsed = 0;
    timeRemaining = currentPassage.timeLimit;

    const inputField = document.getElementById('typing-hidden-input');
    if (inputField) {
      inputField.value = '';
      inputField.focus({ preventScroll: true });
    }

    const startContainer = document.getElementById('arena-start-container');
    if (startContainer) startContainer.style.display = 'none';

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeElapsed++;
      timeRemaining--;

      const timerEl = document.getElementById('typing-live-timer');
      const timerProgress = document.getElementById('typing-timer-bar');

      if (timerEl) timerEl.textContent = `${Math.max(0, timeRemaining)}s`;
      if (timerProgress) {
        const percent = (timeRemaining / currentPassage.timeLimit) * 100;
        timerProgress.style.width = `${Math.max(0, percent)}%`;
      }

      calculateMetrics();

      if (timeRemaining <= 0) {
        finishTypingTest(false);
      }
    }, 1000);
  }

  function calculateMetrics() {
    const minutes = Math.max(timeElapsed, 1) / 60;
    const rawWpm = Math.round((correctKeystrokes / 5) / minutes);
    calculatedWpm = Math.max(0, rawWpm);

    const totalTyped = totalKeystrokes || 1;
    calculatedAccuracy = Math.max(0, Math.min(100, Math.round(((totalTyped - errorCount) / totalTyped) * 100)));

    updateLiveMetrics(calculatedWpm, calculatedAccuracy);
    updateLiveRankTracking(calculatedWpm, calculatedAccuracy);
  }

  function updateLiveMetrics(wpm, accuracy) {
    const liveWpmEl = document.getElementById('typing-live-wpm');
    const liveAccEl = document.getElementById('typing-live-acc');
    const liveErrEl = document.getElementById('typing-live-err');

    if (liveWpmEl) liveWpmEl.textContent = wpm;
    if (liveAccEl) liveAccEl.textContent = `${accuracy}%`;
    if (liveErrEl) liveErrEl.textContent = errorCount;
  }

  // Real-Time Ranking & Target Chasing Feature
  function updateLiveRankTracking(wpm, accuracy) {
    const liveRankEl = document.getElementById('typing-live-rank');
    const chasingEl = document.getElementById('typing-live-chasing');
    if (!liveRankEl || !chasingEl) return;

    if (!testActive && wpm === 0) {
      liveRankEl.textContent = '#--';
      chasingEl.textContent = 'Ready';
      return;
    }

    // Exclude current player when determining relative rank
    const myNick = (currentPlayer.nickname || '').toLowerCase();
    const otherPlayers = leaderboard.filter(item => (item.nickname || '').toLowerCase() !== myNick);

    // Calculate how many people have a higher score
    let beatCount = 0;
    let nextTarget = null;

    // Sort descending by wpm, accuracy
    const sortedOthers = [...otherPlayers].sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy);

    for (let i = 0; i < sortedOthers.length; i++) {
      const p = sortedOthers[i];
      if (p.wpm > wpm || (p.wpm === wpm && p.accuracy > accuracy)) {
        beatCount++;
        // The one directly above the user is our immediate chase target
        nextTarget = p;
      }
    }

    const currentRank = beatCount + 1;
    liveRankEl.textContent = `#${currentRank}`;

    if (currentRank === 1) {
      liveRankEl.textContent = '👑 #1 APEX';
      chasingEl.textContent = '🔥 UNDISPUTED LEADER!';
      chasingEl.style.color = '#f59e0b';
    } else if (nextTarget) {
      const wpmDiff = Math.max(1, nextTarget.wpm - wpm);
      chasingEl.textContent = `⚔️ ${nextTarget.avatar} ${nextTarget.nickname} (+${wpmDiff} WPM)`;
      chasingEl.style.color = '#38bdf8';
    } else {
      chasingEl.textContent = 'Pushing Pace...';
      chasingEl.style.color = '#94a3b8';
    }
  }

  function resetTypingTest(showStartBtn = true) {
    clearInterval(timerInterval);
    testActive = false;
    testFinished = false;
    timeElapsed = 0;
    totalKeystrokes = 0;
    correctKeystrokes = 0;
    errorCount = 0;
    calculatedWpm = 0;
    calculatedAccuracy = 100;

    const inputField = document.getElementById('typing-hidden-input');
    if (inputField) inputField.value = '';

    const timerProgress = document.getElementById('typing-timer-bar');
    if (timerProgress) timerProgress.style.width = '100%';

    const startContainer = document.getElementById('arena-start-container');
    if (startContainer && showStartBtn) startContainer.style.display = 'block';

    loadPassage();
  }

  function finishTypingTest(completedFullText) {
    clearInterval(timerInterval);
    testActive = false;
    testFinished = true;

    calculateMetrics();

    CharityAudio.playCelebration();
    CharityConfetti.launch();

    const startContainer = document.getElementById('arena-start-container');
    if (startContainer) startContainer.style.display = 'block';

    const testResults = {
      wpm: calculatedWpm,
      accuracy: calculatedAccuracy,
      time: timeElapsed,
      characters: correctKeystrokes,
      level: currentPlayer.level,
      completedFullText
    };

    // Auto-record player's verified result to SQLite database immediately
    submitScoreToLeaderboard(testResults);

    showResultsModal(testResults);
  }

  // --- Results Modal & Post-Challenge Flow ---
  function showResultsModal(results) {
    const modal = document.getElementById('results-modal');
    if (!modal) return;

    const wpmValEl = document.getElementById('result-wpm-val');
    const accValEl = document.getElementById('result-acc-val');
    const timeValEl = document.getElementById('result-time-val');
    const badgeEl = document.getElementById('result-rank-badge');
    const titleEl = document.getElementById('result-player-title');
    const challengeBeatAlert = document.getElementById('result-challenge-alert');
    const submitBtn = document.getElementById('submit-to-leaderboard-btn');
    const retryBtn = document.getElementById('retry-challenge-btn');
    const shareBtn = document.getElementById('open-share-modal-btn');

    if (wpmValEl) wpmValEl.textContent = results.wpm;
    if (accValEl) accValEl.textContent = `${results.accuracy}%`;
    if (timeValEl) timeValEl.textContent = `${results.time}s`;

    const rankInfo = getRankInfo(results.wpm);
    if (badgeEl) {
      badgeEl.textContent = `${rankInfo.emoji} ${rankInfo.title}`;
      badgeEl.className = `rank-badge ${rankInfo.className}`;
    }

    if (titleEl) {
      titleEl.textContent = `${currentPlayer.avatar} ${currentPlayer.nickname || 'Anonymous Typist'}`;
    }

    if (challengeInfo && challengeBeatAlert) {
      challengeBeatAlert.classList.remove('hidden');
      if (results.wpm >= challengeInfo.wpm) {
        challengeBeatAlert.className = 'challenge-alert success';
        challengeBeatAlert.innerHTML = `🎉 <strong>Challenge Won!</strong> You scored ${results.wpm} WPM and crushed <strong>${challengeInfo.name}</strong> (${challengeInfo.wpm} WPM)!`;
      } else {
        challengeBeatAlert.className = 'challenge-alert notice';
        challengeBeatAlert.innerHTML = `🔥 Defeat! You scored ${results.wpm} WPM vs <strong>${challengeInfo.name}</strong>'s ${challengeInfo.wpm} WPM. Retry to conquer!`;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '✓ Score Posted on Leaderboard!';
    }

    if (retryBtn) {
      retryBtn.onclick = () => {
        closeModal('results-modal');
        triggerCountdown();
      };
    }

    if (shareBtn) {
      shareBtn.onclick = () => {
        closeModal('results-modal');
        openShareModal(results.wpm, results.accuracy);
      };
    }

    openModal('results-modal');
  }

  function getRankInfo(wpm) {
    if (wpm >= 90) return { title: 'Grandmaster Typist', emoji: '🌟', className: 'rank-grandmaster', tier: '👑 GOD TIER' };
    if (wpm >= 70) return { title: 'Lightning Pioneer', emoji: '⚡', className: 'rank-lightning', tier: '⚡ S-TIER' };
    if (wpm >= 50) return { title: 'Digital Champion', emoji: '🚀', className: 'rank-champion', tier: '🔥 PRO' };
    if (wpm >= 30) return { title: 'Future Builder', emoji: '🌱', className: 'rank-builder', tier: '⚔️ CONTENDER' };
    return { title: 'Heart of Gold', emoji: '❤️', className: 'rank-heart', tier: '🌱 ROOKIE' };
  }

  // --- Aggressive Leaderboard Logic & Live Polling ---
  let leaderboardPollTimer = null;

  function initLeaderboard() {
    renderLeaderboard('all');

    const filterBtns = document.querySelectorAll('.leaderboard-tab-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderLeaderboard(btn.dataset.filter);
      });
    });

    const searchInput = document.getElementById('leaderboard-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        renderLeaderboard(getActiveFilter(), query);
      });
    }

    // Set up Real-Time Database polling every 3.5 seconds
    if (leaderboardPollTimer) clearInterval(leaderboardPollTimer);
    leaderboardPollTimer = setInterval(() => {
      fetchLeaderboardFromDB();
    }, 3500);
  }

  function getActiveFilter() {
    const active = document.querySelector('.leaderboard-tab-btn.active');
    return active ? active.dataset.filter : 'all';
  }

  async function submitScoreToLeaderboard(results) {
    if (!currentPlayer.nickname) {
      currentPlayer.nickname = 'Typist_' + Math.floor(Math.random() * 899 + 100);
    }

    const newEntry = {
      id: 'entry-' + Date.now(),
      nickname: currentPlayer.nickname,
      avatar: currentPlayer.avatar,
      level: currentPlayer.level,
      wpm: results.wpm,
      accuracy: results.accuracy,
      time: results.time,
      date: new Date().toISOString().split('T')[0],
      ig: currentPlayer.ig || '',
      donated: currentPlayer.donated || false
    };

    // 1. Optimistic local update
    const existingIndex = leaderboard.findIndex(
      item => item.nickname.toLowerCase() === currentPlayer.nickname.toLowerCase()
    );

    if (existingIndex >= 0) {
      if (results.wpm >= leaderboard[existingIndex].wpm) {
        leaderboard[existingIndex] = { ...leaderboard[existingIndex], ...newEntry };
      }
    } else {
      leaderboard.push(newEntry);
      registeredNicknames.add(currentPlayer.nickname.toLowerCase());
    }

    leaderboard.sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy);
    saveLeaderboard();
    renderLeaderboard(getActiveFilter());
    CharityConfetti.launch(undefined, undefined, 40);

    // 2. Persist to SQLite Backend Database via POST /api/score
    try {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });

      if (response.ok) {
        const result = await response.json();
        // Immediately fetch fresh global rankings from DB
        await fetchLeaderboardFromDB();
        if (result.currentRank) {
          const badgeEl = document.getElementById('result-rank-badge');
          if (badgeEl) {
            badgeEl.textContent = `Global Rank #${result.currentRank}`;
          }
        }
      }
    } catch (err) {
      console.warn('Error syncing score to database:', err);
    }
  }

  function renderLeaderboard(filter = 'all', searchQuery = '') {
    const podiumEl = document.getElementById('leaderboard-podium');
    const tableBody = document.getElementById('leaderboard-table-body');
    if (!tableBody) return;

    let filtered = [...leaderboard];

    if (filter !== 'all') {
      filtered = filtered.filter(item => item.level === filter);
    }

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.nickname.toLowerCase().includes(searchQuery) ||
        (item.ig && item.ig.toLowerCase().includes(searchQuery))
      );
    }

    // Points formula: WPM * (Accuracy / 100) * 10
    filtered.forEach(item => {
      const w = item.wpm || 0;
      const acc = item.accuracy !== undefined ? item.accuracy : 100;
      item.points = Math.round(w * (acc / 100) * 10);
    });

    // Rank strictly by points (or WPM, then accuracy)
    filtered.sort((a, b) => b.points - a.points || b.wpm - a.wpm || b.accuracy - a.accuracy);

    // Update live total count banner
    const totalCountEl = document.getElementById('leaderboard-total-count');
    if (totalCountEl) {
      totalCountEl.textContent = filtered.length;
    }

    if (podiumEl && !searchQuery) {
      renderPodium(filtered.slice(0, 3));
    }

    tableBody.innerHTML = '';
    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No typists found in this category yet. Be the first to take the throne!</td></tr>`;
      return;
    }

    filtered.forEach((entry, idx) => {
      const isCurrentUser = currentPlayer.nickname && entry.nickname.toLowerCase() === currentPlayer.nickname.toLowerCase();
      const tr = document.createElement('tr');
      if (isCurrentUser) tr.className = 'highlight-user-row';

      const rankBadge = idx === 0 ? '👑 #1 APEX' : idx === 1 ? '🥈 #2 TITAN' : idx === 2 ? '🥉 #3 GLADIATOR' : `#${idx + 1}`;
      const igHandle = entry.ig ? `<a href="https://instagram.com/${entry.ig}" target="_blank" rel="noopener" class="ig-tag">@${entry.ig}</a>` : '';
      const donorTag = entry.donated ? `<span class="badge-donor" title="Campaign Supporter">❤️ Donor</span>` : '';
      const tierTag = getRankInfo(entry.wpm).tier;

      tr.innerHTML = `
        <td class="col-rank">${rankBadge}</td>
        <td class="col-user">
          <span class="user-avatar">${entry.avatar || '🚀'}</span>
          <div class="user-info">
            <span class="user-name">${escapeHtml(entry.nickname)} ${donorTag}</span>
            ${igHandle}
          </div>
        </td>
        <td class="col-pts"><strong>${entry.points}</strong> <span class="metric-unit">PTS</span></td>
        <td class="col-wpm"><strong>${entry.wpm}</strong> <span class="metric-unit">WPM</span></td>
        <td class="col-acc">${entry.accuracy}%</td>
        <td class="col-level"><span class="badge-level ${entry.level}">${tierTag}</span></td>
        <td class="col-action">
          <button class="btn-fight-typist" data-user="${escapeHtml(entry.nickname)}" data-wpm="${entry.wpm}">⚔️ DEFEAT SCORE</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    tableBody.querySelectorAll('.btn-fight-typist').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetUser = btn.getAttribute('data-user');
        const targetWpm = btn.getAttribute('data-wpm');
        openChallengeShareModal(targetUser, targetWpm);
      });
    });
  }

  function renderPodium(top3) {
    const podiumEl = document.getElementById('leaderboard-podium');
    if (!podiumEl) return;
    podiumEl.innerHTML = '';

    const validPlayers = top3.filter(Boolean);
    if (validPlayers.length === 0) {
      podiumEl.style.display = 'none';
      return;
    }
    podiumEl.style.display = 'flex';

    let podiumOrder = [];
    if (validPlayers.length === 1) {
      podiumOrder = [{ player: validPlayers[0], rank: '1st', medal: '🔥👑', label: 'UNDISPUTED #1 APEX KING' }];
    } else if (validPlayers.length === 2) {
      podiumOrder = [
        { player: validPlayers[0], rank: '1st', medal: '🔥👑', label: 'UNDISPUTED #1 APEX KING' },
        { player: validPlayers[1], rank: '2nd', medal: '🥈', label: '#2 APEX TITAN' }
      ];
    } else {
      podiumOrder = [
        { player: validPlayers[1], rank: '2nd', medal: '🥈', label: '#2 APEX TITAN' },
        { player: validPlayers[0], rank: '1st', medal: '🔥👑', label: 'UNDISPUTED #1 APEX KING' },
        { player: validPlayers[2], rank: '3rd', medal: '🥉', label: '#3 SPEED GLADIATOR' }
      ];
    }

    podiumOrder.forEach(item => {
      const player = item.player;
      if (!player) return;
      const card = document.createElement('div');
      card.className = `podium-card rank-${item.rank.toLowerCase()}`;

      card.innerHTML = `
        <div class="podium-crown">${item.medal}</div>
        <div class="podium-rank-tag">${item.label}</div>
        <div class="podium-avatar">${player.avatar || '🚀'}</div>
        <div class="podium-name">${escapeHtml(player.nickname)}</div>
        <div class="podium-wpm">${player.points || Math.round((player.wpm||0) * ((player.accuracy||100)/100) * 10)} <span>PTS</span></div>
        <div class="podium-meta">${player.wpm} WPM • ${player.accuracy}% Acc • ${capitalize(player.level)}</div>
        ${player.ig ? `<div class="podium-ig">@${escapeHtml(player.ig)}</div>` : ''}
        ${player.donated ? `<div class="podium-donor">❤️ Champion Donor</div>` : ''}
      `;
      podiumEl.appendChild(card);
    });
  }

  // --- Mini QR Code at the Very End (Encodes THIS WEBSITE) ---
  function initQRCodes() {
    renderWebsiteQR();
  }

  function renderWebsiteQR() {
    const canvas = document.getElementById('website-qr-canvas');
    if (!canvas || !window.CharityQR) return;
    const currentWebUrl = window.location.origin + window.location.pathname;
    CharityQR.renderToCanvas(currentWebUrl, canvas, {
      size: 160,
      margin: 2,
      darkColor: '#0f172a',
      lightColor: '#ffffff'
    });
  }

  // --- Social Media Story & Share Card Generator ---
  function initSocialSharing() {
    const copyLinkBtn = document.getElementById('copy-challenge-link-btn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', copyPersonalChallengeLink);
    }

    const shareWaBtn = document.getElementById('share-whatsapp-btn');
    if (shareWaBtn) {
      shareWaBtn.addEventListener('click', shareViaWhatsApp);
    }

    const shareIgBtn = document.getElementById('share-instagram-btn');
    if (shareIgBtn) {
      shareIgBtn.addEventListener('click', copyInstagramCaption);
    }

    const downloadCardBtn = document.getElementById('download-share-card-btn');
    if (downloadCardBtn) {
      downloadCardBtn.addEventListener('click', downloadStoryCardImage);
    }
  }

  function openShareModal(wpm, accuracy) {
    const modal = document.getElementById('share-score-modal');
    if (!modal) return;

    wpm = wpm || calculatedWpm || 65;
    accuracy = accuracy || calculatedAccuracy || 98;

    generateStoryCardCanvas(wpm, accuracy);

    const linkInput = document.getElementById('share-link-input');
    if (linkInput) {
      linkInput.value = generatePersonalChallengeUrl(wpm);
    }

    openModal('share-score-modal');
  }

  function openChallengeShareModal(targetUser, targetWpm) {
    const modal = document.getElementById('share-score-modal');
    if (!modal) return;
    generateStoryCardCanvas(targetWpm, 98, targetUser);

    const linkInput = document.getElementById('share-link-input');
    if (linkInput) {
      linkInput.value = generatePersonalChallengeUrl(targetWpm, targetUser);
    }

    openModal('share-score-modal');
  }

  function generatePersonalChallengeUrl(wpm, name) {
    const baseUrl = window.location.origin + window.location.pathname;
    const challengerName = name || currentPlayer.nickname || 'A Challenger';
    return `${baseUrl}?challenger=${encodeURIComponent(challengerName)}&wpm=${wpm || 60}`;
  }

  function generateStoryCardCanvas(wpm, accuracy, overrideName) {
    const canvas = document.getElementById('story-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = 1080;
    canvas.height = 1080;

    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#0a0f1d');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    ctx.save();
    const neonGrad = ctx.createRadialGradient(200, 200, 10, 200, 200, 350);
    neonGrad.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
    neonGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = neonGrad;
    ctx.beginPath();
    ctx.arc(200, 200, 350, 0, Math.PI * 2);
    ctx.fill();

    const purpleGrad = ctx.createRadialGradient(900, 900, 10, 900, 900, 400);
    purpleGrad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
    purpleGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = purpleGrad;
    ctx.beginPath();
    ctx.arc(900, 900, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 14;
    ctx.strokeRect(40, 40, 1000, 1000);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BEYOND THE ORDINARY PRESENTS', 540, 115);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 56px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('TYPE TO CHANGE A FUTURE', 540, 185);

    ctx.fillStyle = '#ef4444';
    ctx.font = '800 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('TYPE. SCORE. CHALLENGE. REPEAT.', 540, 230);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(100, 275, 880, 450, 28);
    ctx.fill();
    ctx.stroke();

    const name = overrideName || currentPlayer.nickname || 'Speed Typist';
    const avatar = currentPlayer.avatar || '🚀';
    ctx.font = '72px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(avatar, 540, 365);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(name, 540, 425);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 130px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`${wpm}`, 540, 560);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('WORDS PER MINUTE', 540, 615);

    const rank = getRankInfo(wpm);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`${rank.emoji} ${rank.title} • ${accuracy}% Accuracy`, 540, 675);

    ctx.fillStyle = '#ef4444';
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('⚔️ CAN YOU DEFEAT MY SCORE? TAP TO BATTLE!', 540, 785);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 30px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Empowering Children Through Digital Literacy', 540, 875);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Instagram: @type4future  •  TikTok: @type4future', 540, 940);
  }

  function downloadStoryCardImage() {
    const canvas = document.getElementById('story-card-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `TypeToChange_ScoreCard_${currentPlayer.nickname || 'Player'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function copyPersonalChallengeLink() {
    const linkInput = document.getElementById('share-link-input');
    const btn = document.getElementById('copy-challenge-link-btn');
    if (!linkInput) return;

    navigator.clipboard.writeText(linkInput.value).then(() => {
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
      }
    });
  }

  function shareViaWhatsApp() {
    const wpm = calculatedWpm || 65;
    const challengeUrl = generatePersonalChallengeUrl(wpm);
    const msg = `⚡ I just scored *${wpm} WPM* on the *Type to change a future* charity challenge by Team Beyond the Ordinary!\n\nCan you beat my typing score? Accept the battle here:\n👉 ${challengeUrl}\n\nJoin us in empowering underprivileged children with digital skills and literacy.\n\n#TypeToChangeAFuture #type4future`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }

  function copyInstagramCaption() {
    const btn = document.getElementById('share-instagram-btn');
    const wpm = calculatedWpm || 65;
    const caption = `🔥 I just typed ${wpm} WPM in the #TypeToChangeAFuture challenge by Team Beyond the Ordinary! Can you beat my score?\n\nJoin the battle & support children who lack computers and digital learning access!\n\nFollow @type4future on Instagram & TikTok!\n\n#type4future #BeyondTheOrdinary #CharityChallenge #DigitalLiteracy`;

    navigator.clipboard.writeText(caption).then(() => {
      if (btn) {
        btn.textContent = '✓ Caption Copied!';
        setTimeout(() => { btn.textContent = '📸 Copy Instagram / TikTok Caption'; }, 2200);
      }
    });
  }

  // --- Pledge Modal & Give.Asia Integration (Removed) ---
  function initPledgeModal() {
    // Pledge modal removed
  }

  // --- Modal Helpers ---
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(el => {
    el.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-container');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  // --- Utilities ---
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

})();
