const express = require('express');
const path = require('path');
const fs = require('fs');

const gameState = require('./gameState');
const songs = require('./songs');
const { truncateWavFile } = require('./wavTruncate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/covers', express.static(path.join(__dirname, '..', 'data', 'covers')));

function correctSongIfFinished() {
  if (!gameState.isFinished()) return undefined;
  const { title, artist, coverUrl } = songs.randomSong;
  return { title, artist, coverUrl };
}

app.get('/api/state', (req, res) => {
  res.json(gameState.getPublicState(correctSongIfFinished()));
});

app.get('/api/titles', (req, res) => {
  res.json(songs.getPlayableTitles());
});

app.get('/audio/track', async (req, res) => {
  const seconds = gameState.isFinished() ? Infinity : gameState.currentAllowedSeconds();
  const filePath = songs.getTodaysAudioPath();
  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'no-store');

  if (!Number.isFinite(seconds)) {
    // Full track once the round is finished: stream it rather than reading
    // the whole (potentially tens-of-MB) file into memory first.
    fs.createReadStream(filePath)
      .on('error', () => res.status(500).json({ error: 'AUDIO_UNAVAILABLE' }))
      .pipe(res);
    return;
  }

  try {
    const wavBuffer = await truncateWavFile(filePath, seconds);
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

  const isCorrect = matchedSong.id === songs.randomSong.id;
  gameState.applyGuess(matchedSong.title, isCorrect);

  res.json({
    correct: isCorrect,
    state: gameState.getPublicState(correctSongIfFinished()),
  });
});

app.post('/api/skip', (req, res) => {
  if (gameState.isFinished()) {
    return res.status(409).json({ error: 'GAME_FINISHED' });
  }

  gameState.applySkip();

  res.json({
    state: gameState.getPublicState(correctSongIfFinished()),
  });
});

app.post('/api/reset', (req, res) => {
  // Dev-only convenience route, not authenticated. Must be protected/removed
  // before any multi-user deployment (see US-6.1 known limitation).
  songs.selectNewSong();
  const state = gameState.reset();
  res.json(state);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LLMQ server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
