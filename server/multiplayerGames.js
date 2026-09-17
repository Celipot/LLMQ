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
  const player = { playerId: crypto.randomUUID(), nickname };
  game.players.push(player);
  return { playerId: player.playerId, players: game.players };
}

function removePlayer(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) return;
  game.players = game.players.filter((player) => player.playerId !== playerId);
}

module.exports = {
  createGame,
  getGame,
  joinGame,
  removePlayer,
};
