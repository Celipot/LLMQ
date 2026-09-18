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

test('removePlayer deletes the game once the last player leaves', () => {
  const game = multiplayerGames.createGame();
  const { playerId } = multiplayerGames.joinGame(game.gameId, 'Alice');
  multiplayerGames.removePlayer(game.gameId, playerId);
  assert.equal(multiplayerGames.getGame(game.gameId), undefined);
});

test('removePlayer keeps the game when other players remain', () => {
  const game = createLobbyWithTwoPlayers();
  const [alice] = multiplayerGames.getGame(game.gameId).players;
  multiplayerGames.removePlayer(game.gameId, alice.playerId);
  const stored = multiplayerGames.getGame(game.gameId);
  assert.ok(stored);
  assert.equal(stored.players.length, 1);
  assert.equal(stored.players[0].nickname, 'Bob');
});

test('removePlayer is a no-op for an unknown gameId', () => {
  assert.doesNotThrow(() => multiplayerGames.removePlayer('unknown-game', 'unknown-player'));
});

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

test('startGame throws NOT_ENOUGH_PLAYERS with no players', () => {
  const game = multiplayerGames.createGame();
  assert.throws(() => multiplayerGames.startGame(game.gameId, game.hostToken, () => 1), /NOT_ENOUGH_PLAYERS/);
});

test('startGame succeeds with a single player (solo)', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  const started = multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  assert.equal(started.status, 'in_progress');
  assert.equal(started.players.length, 1);
});

const findSongByTitle = (title) => (title === 'Correct Title' ? { id: 42, title: 'Correct Title' } : null);
const computeScore = (stage) => 100 - stage;

function startedGameWithTwoPlayers() {
  const game = createLobbyWithTwoPlayers();
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  return game;
}

test('submitAnswer marks the player found and records the stage on a correct guess', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  const result = multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore);
  assert.equal(result.correct, true);
  const alice = multiplayerGames.getGame(game.gameId).players[0];
  assert.equal(alice.status, 'found');
  assert.equal(alice.foundStage, 1);
});

test('submitAnswer records the score computed for the stage found', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore);
  const alice = multiplayerGames.getGame(game.gameId).players[0];
  assert.equal(alice.score, computeScore(1));
});

test('submitAnswer does not set a score on a wrong guess', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Wrong Title', findSongByTitle, computeScore);
  const alice = multiplayerGames.getGame(game.gameId).players[0];
  assert.equal(alice.score, undefined);
});

test('submitAnswer leaves the player active and allows retrying on a wrong guess', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  const result = multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Wrong Title', findSongByTitle, computeScore);
  assert.equal(result.correct, false);
  const alice = multiplayerGames.getGame(game.gameId).players[0];
  assert.equal(alice.status, 'active');
  const second = multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore);
  assert.equal(second.correct, true);
});

test('submitAnswer throws ALREADY_ANSWERED once the player has already found the answer', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore);
  assert.throws(
    () => multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore),
    /ALREADY_ANSWERED/
  );
});

test('submitAnswer throws GAME_NOT_IN_PROGRESS before the game has started', () => {
  const game = createLobbyWithTwoPlayers();
  const alicePlayerId = game.players[0].playerId;
  assert.throws(
    () => multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore),
    /GAME_NOT_IN_PROGRESS/
  );
});

test('submitAnswer throws PLAYER_NOT_FOUND for an unknown playerId', () => {
  const game = startedGameWithTwoPlayers();
  assert.throws(
    () => multiplayerGames.submitAnswer(game.gameId, 'unknown-player', 'Correct Title', findSongByTitle, computeScore),
    /PLAYER_NOT_FOUND/
  );
});

test('forfeitStage marks the player forfeited for the current stage', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  const result = multiplayerGames.forfeitStage(game.gameId, alicePlayerId);
  assert.equal(result.stage, 1);
  const alice = multiplayerGames.getGame(game.gameId).players[0];
  assert.equal(alice.status, 'forfeited');
});

test('forfeitStage throws ALREADY_ANSWERED once the player has already found the answer', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore);
  assert.throws(() => multiplayerGames.forfeitStage(game.gameId, alicePlayerId), /ALREADY_ANSWERED/);
});

test('forfeitStage throws ALREADY_ANSWERED once the player has already forfeited', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  multiplayerGames.forfeitStage(game.gameId, alicePlayerId);
  assert.throws(() => multiplayerGames.forfeitStage(game.gameId, alicePlayerId), /ALREADY_ANSWERED/);
});

test('forfeitStage throws GAME_NOT_IN_PROGRESS before the game has started', () => {
  const game = createLobbyWithTwoPlayers();
  assert.throws(
    () => multiplayerGames.forfeitStage(game.gameId, game.players[0].playerId),
    /GAME_NOT_IN_PROGRESS/
  );
});

test('forfeitStage throws PLAYER_NOT_FOUND for an unknown playerId', () => {
  const game = startedGameWithTwoPlayers();
  assert.throws(() => multiplayerGames.forfeitStage(game.gameId, 'unknown-player'), /PLAYER_NOT_FOUND/);
});

test('timeoutStage forfeits every still-active player and returns their ids', () => {
  const game = startedGameWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  const timedOut = multiplayerGames.timeoutStage(game.gameId, 1);
  assert.deepEqual(timedOut.sort(), [alice.playerId, bob.playerId].sort());
  assert.equal(alice.status, 'forfeited');
  assert.equal(alice.forfeitReason, 'timeout');
  assert.equal(bob.status, 'forfeited');
});

test('timeoutStage leaves players who already found or forfeited untouched', () => {
  const game = startedGameWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  const timedOut = multiplayerGames.timeoutStage(game.gameId, 1);
  assert.deepEqual(timedOut, [bob.playerId]);
  assert.equal(alice.status, 'found');
  assert.equal(alice.forfeitReason, undefined);
});

test('timeoutStage is a no-op for a game that has not started', () => {
  const game = createLobbyWithTwoPlayers();
  assert.deepEqual(multiplayerGames.timeoutStage(game.gameId, 1), []);
});

test('timeoutStage is a no-op once the stage has already moved on', () => {
  const game = startedGameWithTwoPlayers();
  assert.deepEqual(multiplayerGames.timeoutStage(game.gameId, 2), []);
});

const durationForStage = (stage) => stage * 10;

test('checkStageProgress is a no-op while a player is still active', () => {
  const game = startedGameWithTwoPlayers();
  const alicePlayerId = multiplayerGames.getGame(game.gameId).players[0].playerId;
  multiplayerGames.submitAnswer(game.gameId, alicePlayerId, 'Correct Title', findSongByTitle, computeScore);
  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);
  assert.deepEqual(result, { type: 'none' });
  assert.equal(multiplayerGames.getGame(game.gameId).stage, 1);
});

test('checkStageProgress advances the stage once everyone resolved, resetting forfeited players but not found ones', () => {
  const game = startedGameWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);

  assert.equal(result.type, 'advanced');
  assert.equal(result.stage, 2);
  assert.equal(result.durationSeconds, 20);
  assert.equal(multiplayerGames.getGame(game.gameId).stage, 2);
  assert.equal(alice.status, 'found', 'a found player must not be reset');
  assert.equal(bob.status, 'active', 'a forfeited player gets another try next stage');
  assert.equal(bob.forfeitReason, undefined);
});

test('checkStageProgress ends the game once the last stage resolves', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  multiplayerGames.joinGame(game.gameId, 'Bob');
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  const stored = multiplayerGames.getGame(game.gameId);
  stored.stage = 6; // last stage
  const [alice, bob] = stored.players;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);

  assert.equal(result.type, 'ended');
  assert.equal(result.songId, 42);
  assert.equal(stored.status, 'ended');
  const resultAlice = result.players.find((p) => p.playerId === alice.playerId);
  assert.equal(resultAlice.foundStage, 6);
});

test('checkStageProgress is a no-op for a game that has not started', () => {
  const game = createLobbyWithTwoPlayers();
  assert.deepEqual(multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6), { type: 'none' });
});

test('startGame sets stageStartedAt', () => {
  const game = createLobbyWithTwoPlayers();
  const before = Date.now();
  const started = multiplayerGames.startGame(game.gameId, game.hostToken, () => 1);
  assert.ok(started.stageStartedAt >= before);
});

test('checkStageProgress refreshes stageStartedAt on advance', async () => {
  const game = startedGameWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  const firstStartedAt = multiplayerGames.getGame(game.gameId).stageStartedAt;
  await new Promise((resolve) => setTimeout(resolve, 5));
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);
  multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);
  assert.ok(multiplayerGames.getGame(game.gameId).stageStartedAt > firstStartedAt);
});

test('joinGame marks the new player connected', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  assert.equal(multiplayerGames.getGame(game.gameId).players[0].connected, true);
});

test('markConnected and markDisconnected flip the player connected flag', () => {
  const game = startedGameWithTwoPlayers();
  const alice = multiplayerGames.getGame(game.gameId).players[0];
  multiplayerGames.markDisconnected(game.gameId, alice.playerId);
  assert.equal(alice.connected, false);
  multiplayerGames.markConnected(game.gameId, alice.playerId);
  assert.equal(alice.connected, true);
});

test('markDisconnected is a no-op for an unknown player or game', () => {
  const game = startedGameWithTwoPlayers();
  assert.doesNotThrow(() => multiplayerGames.markDisconnected(game.gameId, 'unknown-player'));
  assert.doesNotThrow(() => multiplayerGames.markDisconnected('unknown-game', 'unknown-player'));
});
