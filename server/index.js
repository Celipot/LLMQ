const express = require('express');
const path = require('path');

const gameState = require('./gameState');
const songs = require('./songs');
const { truncateWavFile } = require('./wavTruncate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function correctTitleIfFinished() {
  return gameState.isFinished() ? songs.todaysSong.title : undefined;
}

app.get('/api/state', (req, res) => {
  res.json(gameState.getPublicState(correctTitleIfFinished()));
});

app.get('/api/titles', (req, res) => {
  res.json(songs.getPlayableTitles());
});

app.get('/audio/track', (req, res) => {
  const seconds = gameState.isFinished() ? Infinity : gameState.currentAllowedSeconds();
  try {
    const filePath = songs.getTodaysAudioPath();
    const wavBuffer = Number.isFinite(seconds)
      ? truncateWavFile(filePath, seconds)
      : require('fs').readFileSync(filePath);
    res.set('Content-Type', 'audio/wav');
    res.set('Cache-Control', 'no-store');
    res.send(wavBuffer);
  } catch (err) {
    res.status(500).json({ error: 'AUDIO_UNAVAILABLE' });
  }
});

app.post('/api/guess', (req, res) => {
  if (gameState.isFinished()) {
    return res.status(409).json({ error: 'GAME_FINISHED' });
  }

  const { title } = req.body || {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'TITLE_REQUIRED' });
  }

  const matchedSong = songs.findSongByTitle(title);
  if (!matchedSong) {
    return res.status(400).json({ error: 'UNKNOWN_TITLE' });
  }

  const isCorrect = matchedSong.id === songs.todaysSong.id;
  gameState.applyGuess(matchedSong.title, isCorrect);

  res.json({
    correct: isCorrect,
    state: gameState.getPublicState(correctTitleIfFinished()),
  });
});

app.post('/api/skip', (req, res) => {
  if (gameState.isFinished()) {
    return res.status(409).json({ error: 'GAME_FINISHED' });
  }

  gameState.applySkip();

  res.json({
    state: gameState.getPublicState(correctTitleIfFinished()),
  });
});

app.post('/api/reset', (req, res) => {
  // Dev-only convenience route, not authenticated. Must be protected/removed
  // before any multi-user deployment (see US-6.1 known limitation).
  const state = gameState.reset();
  res.json(state);
});

app.listen(PORT, () => {
  console.log(`LLMQ server listening on http://localhost:${PORT}`);
});
