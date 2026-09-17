(() => {
  const playBtn = document.getElementById('play-btn');
  const progressFill = document.getElementById('progress-fill');
  const allowedSecondsEl = document.getElementById('allowed-seconds');
  const pipsEl = document.getElementById('pips');
  const titleInput = document.getElementById('title-input');
  const suggestionsEl = document.getElementById('suggestions');
  const guessBtn = document.getElementById('guess-btn');
  const skipBtn = document.getElementById('skip-btn');
  const errorMsgEl = document.getElementById('error-msg');
  const historyEl = document.getElementById('history');
  const resultEl = document.getElementById('result');
  const resultTitleEl = document.getElementById('result-title');
  const resultAnswerEl = document.getElementById('result-answer');
  const resultSummaryEl = document.getElementById('result-summary');
  const resetBtn = document.getElementById('reset-btn');
  const audioEl = document.getElementById('audio-el');

  let allTitles = [];
  let activeSuggestionIndex = -1;
  let currentState = null;
  let progressRAF = null;

  function normalize(str) {
    return str
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  function formatSeconds(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `0:${String(s).padStart(2, '0')}`;
  }

  async function fetchState() {
    const res = await fetch('/api/state');
    currentState = await res.json();
    renderState();
  }

  async function fetchTitles() {
    const res = await fetch('/api/titles');
    allTitles = await res.json();
  }

  function renderState() {
    const finished = currentState.status !== 'playing';

    allowedSecondsEl.textContent = formatSeconds(currentState.allowedSeconds);

    renderPips();
    renderHistory();

    titleInput.disabled = finished;
    guessBtn.disabled = finished;
    skipBtn.disabled = finished;

    if (finished) {
      resultEl.classList.remove('hidden');
      resultTitleEl.textContent = currentState.status === 'won' ? 'Gagné !' : 'Perdu';
      resultAnswerEl.textContent = `La chanson était : ${currentState.correctTitle}`;
      resultSummaryEl.textContent = `Essais utilisés : ${currentState.attemptsUsed} / ${currentState.maxAttempts}`;
    } else {
      resultEl.classList.add('hidden');
    }
  }

  function renderPips() {
    pipsEl.innerHTML = '';
    for (let i = 0; i < currentState.maxAttempts; i++) {
      const pip = document.createElement('div');
      pip.className = 'pip';
      const entry = currentState.guesses[i];
      if (entry) {
        if (entry.type === 'skip') {
          pip.classList.add('used-skip');
        } else if (entry.correct) {
          pip.classList.add('used-correct');
        } else {
          pip.classList.add('used-wrong');
        }
      }
      pipsEl.appendChild(pip);
    }
  }

  function renderHistory() {
    historyEl.innerHTML = '';
    currentState.guesses.forEach((entry, i) => {
      const item = document.createElement('div');
      if (entry.type === 'skip') {
        item.className = 'history-item skip';
        item.innerHTML = `<span>#${i + 1}</span><span>Skip</span>`;
      } else {
        item.className = `history-item ${entry.correct ? 'correct' : 'wrong'}`;
        item.innerHTML = `<span>#${i + 1}</span><span>${escapeHtml(entry.title)}</span>`;
      }
      historyEl.appendChild(item);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showError(message) {
    errorMsgEl.textContent = message;
  }

  function clearError() {
    errorMsgEl.textContent = '';
  }

  // --- Autocomplete ---

  function renderSuggestions(query) {
    suggestionsEl.innerHTML = '';
    activeSuggestionIndex = -1;

    if (!query.trim()) {
      return;
    }

    const normalizedQuery = normalize(query);
    const matches = allTitles.filter((title) => normalize(title).includes(normalizedQuery));

    matches.forEach((title) => {
      const li = document.createElement('li');
      li.textContent = title;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectSuggestion(title);
      });
      suggestionsEl.appendChild(li);
    });
  }

  function selectSuggestion(title) {
    titleInput.value = title;
    suggestionsEl.innerHTML = '';
    activeSuggestionIndex = -1;
    titleInput.focus();
  }

  function moveActiveSuggestion(delta) {
    const items = Array.from(suggestionsEl.children);
    if (items.length === 0) return;

    if (activeSuggestionIndex >= 0) {
      items[activeSuggestionIndex].classList.remove('active');
    }
    activeSuggestionIndex = (activeSuggestionIndex + delta + items.length) % items.length;
    items[activeSuggestionIndex].classList.add('active');
    items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
  }

  titleInput.addEventListener('input', () => {
    clearError();
    renderSuggestions(titleInput.value);
  });

  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActiveSuggestion(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActiveSuggestion(-1);
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0) {
        e.preventDefault();
        const items = Array.from(suggestionsEl.children);
        selectSuggestion(items[activeSuggestionIndex].textContent);
      } else {
        submitGuess();
      }
    } else if (e.key === 'Escape') {
      suggestionsEl.innerHTML = '';
      activeSuggestionIndex = -1;
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete')) {
      suggestionsEl.innerHTML = '';
      activeSuggestionIndex = -1;
    }
  });

  // --- Actions ---

  async function submitGuess() {
    const title = titleInput.value.trim();
    if (!title) {
      showError('Entre un titre avant de valider.');
      return;
    }
    clearError();

    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(errorText(data.error));
      return;
    }

    titleInput.value = '';
    suggestionsEl.innerHTML = '';
    currentState = data.state;
    renderState();
  }

  async function submitSkip() {
    clearError();
    const res = await fetch('/api/skip', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      showError(errorText(data.error));
      return;
    }

    currentState = data.state;
    renderState();
  }

  async function resetGame() {
    await fetch('/api/reset', { method: 'POST' });
    titleInput.value = '';
    suggestionsEl.innerHTML = '';
    clearError();
    stopProgressAnimation();
    progressFill.style.width = '0%';
    await fetchState();
  }

  function errorText(code) {
    switch (code) {
      case 'UNKNOWN_TITLE':
        return "Ce titre ne fait pas partie des chansons jouables.";
      case 'TITLE_REQUIRED':
        return 'Entre un titre avant de valider.';
      case 'GAME_FINISHED':
        return 'La partie est terminée.';
      default:
        return "Une erreur est survenue.";
    }
  }

  guessBtn.addEventListener('click', submitGuess);
  skipBtn.addEventListener('click', submitSkip);
  resetBtn.addEventListener('click', resetGame);

  // --- Playback ---

  function stopProgressAnimation() {
    if (progressRAF) {
      cancelAnimationFrame(progressRAF);
      progressRAF = null;
    }
  }

  function animateProgress() {
    stopProgressAnimation();
    const allowed = currentState.allowedSeconds;
    function tick() {
      if (audioEl.paused || audioEl.ended) {
        progressRAF = null;
        return;
      }
      const pct = Math.min(100, (audioEl.currentTime / allowed) * 100);
      progressFill.style.width = `${pct}%`;
      progressRAF = requestAnimationFrame(tick);
    }
    progressRAF = requestAnimationFrame(tick);
  }

  playBtn.addEventListener('click', async () => {
    // Always re-fetch: the allowed duration may have changed since last load,
    // and the server is the only source of truth for how much audio is served.
    audioEl.src = `/audio/track?ts=${Date.now()}`;
    progressFill.style.width = '0%';
    try {
      await audioEl.play();
      animateProgress();
    } catch (err) {
      showError("Impossible de lire l'audio.");
    }
  });

  audioEl.addEventListener('ended', () => {
    stopProgressAnimation();
    progressFill.style.width = '100%';
  });

  // --- Init ---

  (async function init() {
    await Promise.all([fetchTitles(), fetchState()]);
  })();
})();
