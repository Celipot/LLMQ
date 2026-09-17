const { test } = require('node:test');
const assert = require('node:assert/strict');
const multiplayerGames = require('./multiplayerGames');

test('createGame returns a lobby game with an id, host token, no players and stage 0', () => {
  const game = multiplayerGames.createGame();
  assert.ok(typeof game.gameId === 'string' && game.gameId.length > 0);
  assert.ok(typeof game.hostToken === 'string' && game.hostToken.length > 0);
  assert.equal(game.status, 'lobby');
  assert.deepEqual(game.players, []);
  assert.equal(game.stage, 0);
});

test('createGame produces a distinct gameId and hostToken on each call', () => {
  const a = multiplayerGames.createGame();
  const b = multiplayerGames.createGame();
  assert.notEqual(a.gameId, b.gameId);
  assert.notEqual(a.hostToken, b.hostToken);
});

test('getGame retrieves a previously created game by id', () => {
  const game = multiplayerGames.createGame();
  assert.equal(multiplayerGames.getGame(game.gameId), game);
});

test('getGame returns undefined for an unknown id', () => {
  assert.equal(multiplayerGames.getGame('unknown-id'), undefined);
});
