// In-memory store for multiplayer game sessions, keyed by gameId. Separate
// from gameState.js (single-player guess tiers per song round) since a
// multiplayer game tracks lobby/players/stage rather than guesses.

const crypto = require('crypto');

const games = new Map();

function createGame() {
  const game = {
    gameId: crypto.randomUUID(),
    hostToken: crypto.randomUUID(),
    status: 'lobby',
    players: [],
    stage: 0,
  };
  games.set(game.gameId, game);
  return game;
}

function getGame(gameId) {
  return games.get(gameId);
}

function fail(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function joinGame(gameId, nickname) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.status !== 'lobby') {
    throw fail('GAME_NOT_JOINABLE');
  }
  if (game.players.some((player) => player.nickname === nickname)) {
    throw fail('NICKNAME_TAKEN');
  }
  const player = { playerId: crypto.randomUUID(), nickname, status: 'active', connected: true };
  game.players.push(player);
  return { playerId: player.playerId, players: game.players };
}

function removePlayer(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) return;
  game.players = game.players.filter((player) => player.playerId !== playerId);
  if (game.players.length === 0) {
    games.delete(gameId);
  }
}

function startGame(gameId, hostToken, pickSongId) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.hostToken !== hostToken) {
    throw fail('NOT_HOST');
  }
  if (game.status !== 'lobby') {
    throw fail('GAME_NOT_STARTABLE');
  }
  if (game.players.length < 1) {
    throw fail('NOT_ENOUGH_PLAYERS');
  }
  game.status = 'in_progress';
  game.stage = 1;
  game.songId = pickSongId();
  game.stageStartedAt = Date.now();
  return game;
}

function submitAnswer(gameId, playerId, title, findSongByTitle, computeScore) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.status !== 'in_progress') {
    throw fail('GAME_NOT_IN_PROGRESS');
  }
  const player = game.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw fail('PLAYER_NOT_FOUND');
  }
  if (player.status !== 'active') {
    throw fail('ALREADY_ANSWERED');
  }

  const matchedSong = findSongByTitle(title);
  const isCorrect = !!matchedSong && matchedSong.id === game.songId;
  if (isCorrect) {
    player.status = 'found';
    player.foundStage = game.stage;
    player.score = computeScore(game.stage);
  }
  return { correct: isCorrect, stage: game.stage };
}

function forfeitStage(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.status !== 'in_progress') {
    throw fail('GAME_NOT_IN_PROGRESS');
  }
  const player = game.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw fail('PLAYER_NOT_FOUND');
  }
  if (player.status !== 'active') {
    throw fail('ALREADY_ANSWERED');
  }

  player.status = 'forfeited';
  return { stage: game.stage };
}

function timeoutStage(gameId, stage) {
  const game = games.get(gameId);
  if (!game || game.status !== 'in_progress' || game.stage !== stage) {
    return [];
  }
  const timedOutPlayerIds = [];
  for (const player of game.players) {
    if (player.status === 'active') {
      player.status = 'forfeited';
      player.forfeitReason = 'timeout';
      timedOutPlayerIds.push(player.playerId);
    }
  }
  return timedOutPlayerIds;
}

// Runs after any event that could resolve the current stage (found,
// forfeited, timed out). "found" is permanent for the whole game (a player
// who already found the song just waits out the remaining stages); only
// "forfeited" players get another try once the stage advances.
function checkStageProgress(gameId, getDurationForStage, maxStage) {
  const game = games.get(gameId);
  if (!game || game.status !== 'in_progress') {
    return { type: 'none' };
  }
  const allResolved = game.players.every((player) => player.status !== 'active');
  if (!allResolved) {
    return { type: 'none' };
  }

  if (game.stage >= maxStage) {
    game.status = 'ended';
    return { type: 'ended', players: game.players, songId: game.songId };
  }

  game.stage += 1;
  game.stageStartedAt = Date.now();
  for (const player of game.players) {
    if (player.status === 'forfeited') {
      player.status = 'active';
      delete player.forfeitReason;
    }
  }
  return { type: 'advanced', stage: game.stage, durationSeconds: getDurationForStage(game.stage) };
}

function markConnected(gameId, playerId) {
  const game = games.get(gameId);
  const player = game && game.players.find((p) => p.playerId === playerId);
  if (player) player.connected = true;
}

function markDisconnected(gameId, playerId) {
  const game = games.get(gameId);
  const player = game && game.players.find((p) => p.playerId === playerId);
  if (player) player.connected = false;
}

module.exports = {
  createGame,
  getGame,
  joinGame,
  removePlayer,
  startGame,
  submitAnswer,
  forfeitStage,
  timeoutStage,
  checkStageProgress,
  markConnected,
  markDisconnected,
};
