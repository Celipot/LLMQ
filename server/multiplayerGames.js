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

module.exports = {
  createGame,
  getGame,
};
