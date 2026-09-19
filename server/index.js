const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const gameState = require('./gameState');
const multiplayerGames = require('./multiplayerGames');
const wsServer = require('./wsServer');
const songs = require('./songs');
const songPicker = require('./songPicker');
const avatars = require('./avatars');
const { truncateWavFile } = require('./wavTruncate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/covers', express.static(path.join(__dirname, '..', 'data', 'covers')));

// The web app routes /game/:id client-side; a shared link must load the SPA shell.
app.get('/game/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

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
  const { id, title, artist, coverUrl } = songs.getSongById(activeSongId);
  return { id, title, artist, coverUrl };
}

// The history comes from the client (the server keeps none per player); an
// absent history means a plain uniform draw. Returns null when it is malformed.
function readHistory(body) {
  if (body?.history === undefined) return {};
  return songPicker.sanitizeHistory(body.history, (id) => songs.getSongById(id) !== null, Date.now());
}

function drawRandomSongId(history) {
  if (Object.keys(history).length === 0) return songs.pickRandomSongId(randomGenerations);
  return songPicker.pickWeightedSongId(songs.getPoolIds(randomGenerations), history, Date.now());
}

let randomGenerations = songs.getGenerations().map((g) => g.generation);

function sameSelection(a, b) {
  return a.length === b.length && a.every((generation) => b.includes(generation));
}

// A new selection must not resume the unfinished round: it was drawn from the
// previous pool, so it may not belong to the generations the player just picked.
function enterRandomMode(generations, history = {}) {
  const selectionChanged = generations !== undefined && !sameSelection(generations, randomGenerations);
  if (selectionChanged) randomGenerations = generations;
  if (
    !selectionChanged &&
    lastRandomSongId !== null &&
    !gameState.isFinished(keyFor('random', lastRandomSongId))
  ) {
    activeSongId = lastRandomSongId;
  } else {
    activeSongId = drawRandomSongId(history);
    lastRandomSongId = activeSongId;
    gameState.resetState(keyFor('random', activeSongId));
  }
  activeKey = keyFor('random', activeSongId);
  return gameState.getPublicState(activeKey, correctSongIfFinished());
}

function forceNewRandomRound(history = {}) {
  activeSongId = drawRandomSongId(history);
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

app.get('/api/generations', (req, res) => {
  res.json(songs.getGenerations());
});

app.post('/api/mode/random', (req, res) => {
  const { generations } = req.body || {};
  if (generations !== undefined && !songs.isValidGenerationSelection(generations)) {
    return res.status(400).json({ error: 'INVALID_GENERATIONS' });
  }
  const history = readHistory(req.body);
  if (history === null) {
    return res.status(400).json({ error: 'INVALID_HISTORY' });
  }
  res.json(enterRandomMode(generations, history));
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
  const history = readHistory(req.body);
  if (history === null) {
    return res.status(400).json({ error: 'INVALID_HISTORY' });
  }
  res.json(forceNewRandomRound(history));
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
  const { nickname, hostToken, avatar } = req.body || {};
  if (typeof nickname !== 'string' || nickname.trim() === '') {
    return res.status(400).json({ error: 'NICKNAME_REQUIRED' });
  }
  let parsedAvatar;
  if (avatar !== undefined && avatar !== null) {
    parsedAvatar = avatars.parseAvatar(avatar);
    if (!parsedAvatar) {
      return res.status(400).json({ error: 'INVALID_AVATAR' });
    }
  }

  try {
    const result = multiplayerGames.joinGame(req.params.id, nickname.trim(), hostToken, parsedAvatar);
    res.json(result);
  } catch (err) {
    const status = JOIN_ERROR_STATUS[err.code] || 500;
    res.status(status).json({ error: err.code || 'JOIN_FAILED' });
  }
});

app.get('/games/:id/players/:playerId/avatar', (req, res) => {
  const avatar = multiplayerGames.getAvatar(req.params.id, req.params.playerId);
  if (!avatar) {
    return res.status(404).json({ error: 'AVATAR_NOT_FOUND' });
  }
  res.set({
    'Content-Type': avatar.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=3600',
  });
  res.send(avatar.buffer);
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
    wsServer.broadcastToGame(game.gameId, { type: 'game:started' });
    const answerWindowMs = game.answerWindowSeconds * 1000;
    wsServer.broadcastToGame(game.gameId, {
      type: 'stage:start',
      stage: game.stage,
      maxStage: gameState.TIERS_SECONDS.length,
      durationSeconds: wsServer.stageDurationFor(game.stage),
      serverTimestamp: Date.now(),
      songIndex: game.songIndex,
      songCount: game.songCount,
      answerWindowMs,
      nextDurationSeconds: wsServer.nextStageDurationFor(game.stage),
    });
    wsServer.scheduleStageTimeout(game.gameId, game.stage, answerWindowMs);
    res.json({ status: game.status });
  } catch (err) {
    const status = START_ERROR_STATUS[err.code] || 500;
    res.status(status).json({ error: err.code || 'START_FAILED' });
  }
});

const SONG_COUNT_ERROR_STATUS = {
  GAME_NOT_FOUND: 404,
  NOT_HOST: 403,
  GAME_NOT_IN_LOBBY: 409,
  INVALID_SONG_COUNT: 400,
};

app.post('/games/:id/songCount', (req, res) => {
  const { hostToken, count } = req.body || {};

  try {
    const game = multiplayerGames.setSongCount(req.params.id, hostToken, count);
    wsServer.broadcastToGame(game.gameId, { type: 'lobby:songCount', songCount: game.songCount });
    res.json({ songCount: game.songCount });
  } catch (err) {
    const status = SONG_COUNT_ERROR_STATUS[err.code] || 500;
    res.status(status).json({ error: err.code || 'SONG_COUNT_FAILED' });
  }
});

const GENERATIONS_ERROR_STATUS = {
  GAME_NOT_FOUND: 404,
  NOT_HOST: 403,
  GAME_NOT_IN_LOBBY: 409,
  INVALID_GENERATIONS: 400,
};

app.post('/games/:id/generations', (req, res) => {
  const { hostToken, generations } = req.body || {};

  try {
    const game = multiplayerGames.setGenerations(req.params.id, hostToken, generations);
    wsServer.broadcastToGame(game.gameId, { type: 'lobby:generations', generations: game.generations });
    res.json({ generations: game.generations });
  } catch (err) {
    const status = GENERATIONS_ERROR_STATUS[err.code] || 500;
    res.status(status).json({ error: err.code || 'GENERATIONS_FAILED' });
  }
});

const ANSWER_WINDOW_ERROR_STATUS = {
  GAME_NOT_FOUND: 404,
  NOT_HOST: 403,
  GAME_NOT_IN_LOBBY: 409,
  INVALID_ANSWER_WINDOW: 400,
};

app.post('/games/:id/answerWindow', (req, res) => {
  const { hostToken, seconds } = req.body || {};

  try {
    const game = multiplayerGames.setAnswerWindowSeconds(req.params.id, hostToken, seconds);
    wsServer.broadcastToGame(game.gameId, {
      type: 'lobby:answerWindow',
      answerWindowSeconds: game.answerWindowSeconds,
    });
    res.json({ answerWindowSeconds: game.answerWindowSeconds });
  } catch (err) {
    const status = ANSWER_WINDOW_ERROR_STATUS[err.code] || 500;
    res.status(status).json({ error: err.code || 'ANSWER_WINDOW_FAILED' });
  }
});

app.get('/games/:id/audio', async (req, res) => {
  const game = multiplayerGames.getGame(req.params.id);
  if (!game || game.songId == null || game.stage < 1) {
    return res.status(404).json({ error: 'GAME_NOT_FOUND' });
  }

  const seconds = wsServer.stageDurationFor(game.stage);
  const filePath = songs.getAudioPath(game.songId);
  res.set('Content-Type', 'audio/wav');
  res.set('Cache-Control', 'no-store');

  try {
    const wavBuffer = await truncateWavFile(filePath, seconds);
    res.send(wavBuffer);
  } catch (err) {
    res.status(500).json({ error: 'AUDIO_UNAVAILABLE' });
  }
});

if (require.main === module) {
  const server = http.createServer(app);
  wsServer.attachWebSocketServer(server);
  server.listen(PORT, () => {
    console.log(`LLMQ server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
