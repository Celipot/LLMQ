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

test('joinGame adds a player with a unique playerId to a lobby game', () => {
  const game = multiplayerGames.createGame();
  const result = multiplayerGames.joinGame(game.gameId, 'Alice');
  assert.ok(typeof result.playerId === 'string' && result.playerId.length > 0);
  assert.equal(result.players.length, 1);
  assert.equal(result.players[0].nickname, 'Alice');
});

test('joinGame throws GAME_NOT_FOUND for an unknown gameId', () => {
  assert.throws(() => multiplayerGames.joinGame('unknown-id', 'Alice'), /GAME_NOT_FOUND/);
});

test('joinGame throws NICKNAME_TAKEN when the nickname is already used in the game', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  assert.throws(() => multiplayerGames.joinGame(game.gameId, 'Alice'), /NICKNAME_TAKEN/);
});

test('joinGame throws GAME_NOT_JOINABLE once the game has left the lobby status', () => {
  const game = multiplayerGames.createGame();
  game.status = 'in_progress';
  assert.throws(() => multiplayerGames.joinGame(game.gameId, 'Alice'), /GAME_NOT_JOINABLE/);
});

function createLobbyWithTwoPlayers() {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  multiplayerGames.joinGame(game.gameId, 'Bob');
  return game;
}

test('startGame moves a lobby with 2+ players to in_progress, sets stage 1 and picks a song', () => {
  const game = createLobbyWithTwoPlayers();
  const started = multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  assert.equal(started.status, 'in_progress');
  assert.equal(started.stage, 1);
  assert.equal(started.songId, 42);
});

test('startGame throws GAME_NOT_FOUND for an unknown gameId', () => {
  assert.throws(() => multiplayerGames.startGame('unknown-id', 'token', () => 1), /GAME_NOT_FOUND/);
});

test('startGame throws NOT_HOST when the token does not match', () => {
  const game = createLobbyWithTwoPlayers();
  assert.throws(() => multiplayerGames.startGame(game.gameId, 'wrong-token', () => 1), /NOT_HOST/);
});

test('startGame throws GAME_NOT_STARTABLE once the game has already started', () => {
  const game = createLobbyWithTwoPlayers();
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 1);
  assert.throws(() => multiplayerGames.startGame(game.gameId, game.hostToken, () => 1), /GAME_NOT_STARTABLE/);
});

test('startGame throws NOT_ENOUGH_PLAYERS with fewer than 2 players', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  assert.throws(() => multiplayerGames.startGame(game.gameId, game.hostToken, () => 1), /NOT_ENOUGH_PLAYERS/);
});
