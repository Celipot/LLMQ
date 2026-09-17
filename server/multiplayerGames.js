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
  const player = { playerId: crypto.randomUUID(), nickname, status: 'active' };
  game.players.push(player);
  return { playerId: player.playerId, players: game.players };
}

function removePlayer(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) return;
  game.players = game.players.filter((player) => player.playerId !== playerId);
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
  if (game.players.length < 2) {
    throw fail('NOT_ENOUGH_PLAYERS');
  }
  game.status = 'in_progress';
  game.stage = 1;
  game.songId = pickSongId();
  return game;
}

function submitAnswer(gameId, playerId, title, findSongByTitle) {
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
  }
  return { correct: isCorrect, stage: game.stage };
}

module.exports = {
  createGame,
  getGame,
  joinGame,
  removePlayer,
  startGame,
  submitAnswer,
};
