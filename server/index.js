const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const gameState = require('./gameState');
const multiplayerGames = require('./multiplayerGames');
const { attachWebSocketServer, broadcastToGame } = require('./wsServer');
const songs = require('./songs');
const { truncateWavFile } = require('./wavTruncate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/covers', express.static(path.join(__dirname, '..', 'data', 'covers')));

// Namespaced so a Random-mode pick never shows up as "en cours" in the List
// mode badges for the same song (that would leak the answer while playing).
function keyFor(mode, songId) {
  return `${mode}:${songId}`;
}

let activeSongId = null;
let activeKey = null;
let lastRandomSongId = null;

function correctSongIfFinished() {
  if (!activeKey || !gameState.isFinished(activeKey)) return undefined;
  const { title, artist, coverUrl } = songs.getSongById(activeSongId);
  return { title, artist, coverUrl };
}

function enterRandomMode() {
  if (lastRandomSongId !== null && !gameState.isFinished(keyFor('random', lastRandomSongId))) {
    activeSongId = lastRandomSongId;
  } else {
    activeSongId = songs.pickRandomSongId();
    lastRandomSongId = activeSongId;
    gameState.resetState(keyFor('random', activeSongId));
  }
  activeKey = keyFor('random', activeSongId);
  return gameState.getPublicState(activeKey, correctSongIfFinished());
}

function forceNewRandomRound() {
  activeSongId = songs.pickRandomSongId();
  lastRandomSongId = activeSongId;
  gameState.resetState(keyFor('random', activeSongId));
  activeKey = keyFor('random', activeSongId);
  return gameState.getPublicState(activeKey, correctSongIfFinished());
}

function selectListSong(songId) {
  activeSongId = songId;
  activeKey = keyFor('list', songId);
  return gameState.getPublicState(activeKey, correctSongIfFinished());
}

enterRandomMode();

app.get('/api/state', (req, res) => {
  res.json(gameState.getPublicState(activeKey, correctSongIfFinished()));
});

app.get('/api/titles', (req, res) => {
  const titles = songs.getPlayableTitles().map((song) => ({
    ...song,
    status: gameState.getStatus(keyFor('list', song.id)),
  }));
  res.json(titles);
});

app.post('/api/mode/random', (req, res) => {
  res.json(enterRandomMode());
});

app.post('/api/songs/:id/select', (req, res) => {
  const songId = Number(req.params.id);
  const song = songs.getSongById(songId);
  if (!song) {
    return res.status(404).json({ error: 'UNKNOWN_SONG' });
  }
  res.json(selectListSong(songId));
});

app.get('/audio/track', async (req, res) => {
  const seconds = gameState.isFinished(activeKey) ? Infinity : gameState.currentAllowedSeconds(activeKey);
  const filePath = songs.getAudioPath(activeSongId);
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
  if (gameState.isFinished(activeKey)) {
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

  const isCorrect = matchedSong.id === activeSongId;
  gameState.applyGuess(activeKey, matchedSong.title, isCorrect);

  res.json({
    correct: isCorrect,
    state: gameState.getPublicState(activeKey, correctSongIfFinished()),
  });
});

app.post('/api/skip', (req, res) => {
  if (gameState.isFinished(activeKey)) {
    return res.status(409).json({ error: 'GAME_FINISHED' });
  }

  gameState.applySkip(activeKey);

  res.json({
    state: gameState.getPublicState(activeKey, correctSongIfFinished()),
  });
});

app.post('/api/reset', (req, res) => {
  // Dev-only convenience route, not authenticated. Must be protected/removed
  // before any multi-user deployment (see US-6.1 known limitation). Always
  // forces a fresh Random-mode draw, matching its pre-existing "rejouer"
  // semantics from the MVP screen.
  res.json(forceNewRandomRound());
});

app.post('/games', (req, res) => {
  try {
    const game = multiplayerGames.createGame();
    res.status(201).json({ gameId: game.gameId, hostToken: game.hostToken });
  } catch (err) {
    res.status(500).json({ error: 'GAME_CREATION_FAILED' });
  }
});

app.get('/games/:id', (req, res) => {
  const game = multiplayerGames.getGame(req.params.id);
  if (!game) {
    return res.status(404).json({ error: 'GAME_NOT_FOUND' });
  }
  res.json({ gameId: game.gameId, status: game.status });
});

const JOIN_ERROR_STATUS = {
  GAME_NOT_FOUND: 404,
  GAME_NOT_JOINABLE: 409,
  NICKNAME_TAKEN: 409,
};

app.post('/games/:id/join', (req, res) => {
  const { nickname } = req.body || {};
  if (typeof nickname !== 'string' || nickname.trim() === '') {
    return res.status(400).json({ error: 'NICKNAME_REQUIRED' });
  }

  try {
    const result = multiplayerGames.joinGame(req.params.id, nickname.trim());
    res.json(result);
  } catch (err) {
    const status = JOIN_ERROR_STATUS[err.code] || 500;
    res.status(status).json({ error: err.code || 'JOIN_FAILED' });
  }
});

const START_ERROR_STATUS = {
  GAME_NOT_FOUND: 404,
  NOT_HOST: 403,
  GAME_NOT_STARTABLE: 409,
  NOT_ENOUGH_PLAYERS: 409,
};

app.post('/games/:id/start', (req, res) => {
  const { hostToken } = req.body || {};

  try {
    const game = multiplayerGames.startGame(req.params.id, hostToken, songs.pickRandomSongId);
    broadcastToGame(game.gameId, { type: 'game:started' });
    broadcastToGame(game.gameId, {
      type: 'stage:start',
      stage: game.stage,
      durationSeconds: gameState.TIERS_SECONDS[0],
      serverTimestamp: Date.now(),
    });
    res.json({ status: game.status });
  } catch (err) {
    const status = START_ERROR_STATUS[err.code] || 500;
    res.status(status).json({ error: err.code || 'START_FAILED' });
  }
});

if (require.main === module) {
  const server = http.createServer(app);
  attachWebSocketServer(server);
  server.listen(PORT, () => {
    console.log(`LLMQ server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
