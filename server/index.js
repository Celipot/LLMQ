const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

const gameState = require('./gameState');
const multiplayerGames = require('./multiplayerGames');
const wsServer = require('./wsServer');
const songs = require('./songs');
const songPicker = require('./songPicker');
const soloSessions = require('./soloSessions');
const careerRounds = require('./careerRounds');
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
// mode badges for the same song (that would leak the answer while playing),
// and per session so two players on the same song never share their attempts.
function keyFor(session, mode, songId) {
  return `${session.id}:${mode}:${songId}`;
}

const soloStore = soloSessions.createStore({
  createSession: () => ({
    activeSongId: null,
    activeKey: null,
    randomGenerations: songs.getGenerations().map((g) => g.generation),
    career: null,
    careerRound: null,
  }),
  onExpire: (id) => gameState.deleteByPrefix(`${id}:`),
});

// <audio src> cannot send headers, so the audio route also takes the id as ?sid=.
function requireSession(req, res, next) {
  const id = req.get('X-Solo-Session') ?? (req.path === '/audio/track' ? req.query.sid : undefined);
  if (!soloSessions.isValidSessionId(id)) {
    return res.status(400).json({ error: 'SESSION_REQUIRED' });
  }
  req.solo = soloStore.get(id);
  next();
}

function requireSoloSession(req, res, next) {
  requireSession(req, res, () => {
    if (req.solo.activeKey === null) enterRandomMode(req.solo);
    next();
  });
}

function correctSongIfFinished(session) {
  if (!session.activeKey || !gameState.isFinished(session.activeKey)) return undefined;
  const { id, title, artist, coverUrl } = songs.getSongById(session.activeSongId);
  return { id, title, artist, coverUrl };
}

// The history comes from the client (the server keeps none per player); an
// absent history means a plain uniform draw. Returns null when it is malformed.
function readHistory(body) {
  if (body?.history === undefined) return {};
  return songPicker.sanitizeHistory(body.history, (id) => songs.getSongById(id) !== null, Date.now());
}

function drawRandomSongId(session, history) {
  if (Object.keys(history).length === 0) return songs.pickRandomSongId(session.randomGenerations);
  return songPicker.pickWeightedSongId(songs.getPoolIds(session.randomGenerations), history, Date.now());
}

function startRandomRound(session, history) {
  session.activeSongId = drawRandomSongId(session, history);
  session.activeKey = keyFor(session, 'random', session.activeSongId);
  gameState.resetState(session.activeKey);
}

function forceNewRandomRound(session, history = {}) {
  startRandomRound(session, history);
  return gameState.getPublicState(session.activeKey, correctSongIfFinished(session));
}

// Leaving Mode Solo abandons its round: entering it again always draws a new one.
function enterRandomMode(session, generations, history = {}) {
  if (generations !== undefined) session.randomGenerations = generations;
  return forceNewRandomRound(session, history);
}

function selectListSong(session, songId) {
  session.activeSongId = songId;
  session.activeKey = keyFor(session, 'list', songId);
  return gameState.getPublicState(session.activeKey, correctSongIfFinished(session));
}

app.get('/api/state', requireSoloSession, (req, res) => {
  const session = req.solo;
  res.json(gameState.getPublicState(session.activeKey, correctSongIfFinished(session)));
});

app.get('/api/titles', requireSoloSession, (req, res) => {
  const titles = songs.getPlayableTitles().map((song) => ({
    ...song,
    status: gameState.getStatus(keyFor(req.solo, 'list', song.id)),
  }));
  res.json(titles);
});

app.get('/api/generations', (req, res) => {
  res.json(songs.getGenerations());
});

app.post('/api/mode/random', requireSoloSession, (req, res) => {
  const { generations } = req.body || {};
  if (generations !== undefined && !songs.isValidGenerationSelection(generations)) {
    return res.status(400).json({ error: 'INVALID_GENERATIONS' });
  }
  const history = readHistory(req.body);
  if (history === null) {
    return res.status(400).json({ error: 'INVALID_HISTORY' });
  }
  res.json(enterRandomMode(req.solo, generations, history));
});

app.post('/api/songs/:id/select', requireSoloSession, (req, res) => {
  const songId = Number(req.params.id);
  const song = songs.getSongById(songId);
  if (!song) {
    return res.status(404).json({ error: 'UNKNOWN_SONG' });
  }
  res.json(selectListSong(req.solo, songId));
});

app.get('/audio/track', requireSoloSession, async (req, res) => {
  const { activeKey, activeSongId } = req.solo;
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

app.post('/api/guess', requireSoloSession, (req, res) => {
  const session = req.solo;
  const { activeKey, activeSongId } = session;
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
    state: gameState.getPublicState(activeKey, correctSongIfFinished(session)),
    ...settledCareer(session),
  });
});

app.post('/api/skip', requireSoloSession, (req, res) => {
  const session = req.solo;
  if (gameState.isFinished(session.activeKey)) {
    return res.status(409).json({ error: 'GAME_FINISHED' });
  }

  gameState.applySkip(session.activeKey);

  res.json({
    state: gameState.getPublicState(session.activeKey, correctSongIfFinished(session)),
    ...settledCareer(session),
  });
});

app.post('/api/reset', requireSoloSession, (req, res) => {
  // Only touches the caller's own session. Always forces a fresh Random-mode
  // draw, matching its pre-existing "rejouer" semantics from the MVP screen.
  const history = readHistory(req.body);
  if (history === null) {
    return res.status(400).json({ error: 'INVALID_HISTORY' });
  }
  res.json(forceNewRandomRound(req.solo, history));
});

// A career round ends through /api/guess or /api/skip, which then also return
// the updated career so the client does not need a second request.
function settledCareer(session) {
  return careerRounds.settleRound(session) ? { career: careerRounds.publicCareer(session) } : {};
}

const CAREER_ERROR_STATUS = {
  INVALID_STAT: 400,
  NO_ENERGY: 409,
  RELEASE_DUE: 409,
  RELEASE_NOT_DUE: 409,
  CONCERT_DUE: 409,
  CONCERT_NOT_DUE: 409,
  CAREER_FINISHED: 409,
};

function requireCareer(req, res, next) {
  if (!req.solo.career) return res.status(404).json({ error: 'NO_CAREER' });
  next();
}

function requireNoCareerRound(req, res, next) {
  if (req.solo.careerRound) return res.status(409).json({ error: 'ROUND_IN_PROGRESS' });
  next();
}

function careerResponse(session) {
  return { career: careerRounds.publicCareer(session), round: careerRounds.publicRound(session) };
}

// Career rule violations are stable error codes, anything else is a real bug.
function careerAction(action) {
  return (req, res) => {
    try {
      action(req.solo, req.body || {});
    } catch (err) {
      const status = CAREER_ERROR_STATUS[err.message];
      if (!status) throw err;
      return res.status(status).json({ error: err.message });
    }
    res.json(careerResponse(req.solo));
  };
}

app.post('/api/career', requireSession, (req, res) => {
  careerRounds.createCareer(req.solo);
  res.json(careerResponse(req.solo));
});

app.delete('/api/career', requireSession, (req, res) => {
  careerRounds.abandonCareer(req.solo);
  res.status(204).end();
});

app.get('/api/career', requireSession, requireCareer, (req, res) => {
  careerRounds.resumeRound(req.solo);
  res.json(careerResponse(req.solo));
});

app.post(
  '/api/career/rest',
  requireSession,
  requireCareer,
  requireNoCareerRound,
  careerAction((session) => careerRounds.rest(session)),
);

app.post(
  '/api/career/study',
  requireSession,
  requireCareer,
  requireNoCareerRound,
  careerAction((session, body) => careerRounds.startStudy(session, body.stat)),
);

app.post(
  '/api/career/single',
  requireSession,
  requireCareer,
  requireNoCareerRound,
  careerAction((session) => careerRounds.startSingle(session)),
);

app.post(
  '/api/career/release',
  requireSession,
  requireCareer,
  requireNoCareerRound,
  careerAction((session) => careerRounds.startRelease(session)),
);

app.post(
  '/api/career/concert',
  requireSession,
  requireCareer,
  requireNoCareerRound,
  careerAction((session) => careerRounds.startConcert(session)),
);

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
