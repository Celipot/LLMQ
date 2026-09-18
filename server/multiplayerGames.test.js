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
  assert.equal(game.songCount, 1);
  assert.equal(game.answerWindowSeconds, 60);
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

test('setSongCount updates the host-chosen song count while in the lobby', () => {
  const game = createLobbyWithTwoPlayers();
  const updated = multiplayerGames.setSongCount(game.gameId, game.hostToken, 5);
  assert.equal(updated.songCount, 5);
});

test('setSongCount accepts the boundaries 1 and 100', () => {
  const game = createLobbyWithTwoPlayers();
  assert.equal(multiplayerGames.setSongCount(game.gameId, game.hostToken, 1).songCount, 1);
  assert.equal(multiplayerGames.setSongCount(game.gameId, game.hostToken, 100).songCount, 100);
});

test('setSongCount throws GAME_NOT_FOUND for an unknown gameId', () => {
  assert.throws(() => multiplayerGames.setSongCount('unknown-id', 'token', 5), /GAME_NOT_FOUND/);
});

test('setSongCount throws NOT_HOST when the token does not match', () => {
  const game = createLobbyWithTwoPlayers();
  assert.throws(() => multiplayerGames.setSongCount(game.gameId, 'wrong-token', 5), /NOT_HOST/);
});

test('setSongCount throws GAME_NOT_IN_LOBBY once the game has started', () => {
  const game = createLobbyWithTwoPlayers();
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 1);
  assert.throws(() => multiplayerGames.setSongCount(game.gameId, game.hostToken, 5), /GAME_NOT_IN_LOBBY/);
});

test('setSongCount throws INVALID_SONG_COUNT for 0, 101 and non-integer values', () => {
  const game = createLobbyWithTwoPlayers();
  assert.throws(() => multiplayerGames.setSongCount(game.gameId, game.hostToken, 0), /INVALID_SONG_COUNT/);
  assert.throws(() => multiplayerGames.setSongCount(game.gameId, game.hostToken, 101), /INVALID_SONG_COUNT/);
  assert.throws(() => multiplayerGames.setSongCount(game.gameId, game.hostToken, 1.5), /INVALID_SONG_COUNT/);
  assert.throws(() => multiplayerGames.setSongCount(game.gameId, game.hostToken, 'abc'), /INVALID_SONG_COUNT/);
});

test('setAnswerWindowSeconds accepts the boundaries 10 and 300', () => {
  const game = createLobbyWithTwoPlayers();
  assert.equal(multiplayerGames.setAnswerWindowSeconds(game.gameId, game.hostToken, 10).answerWindowSeconds, 10);
  assert.equal(multiplayerGames.setAnswerWindowSeconds(game.gameId, game.hostToken, 300).answerWindowSeconds, 300);
});

test('setAnswerWindowSeconds throws GAME_NOT_FOUND for an unknown gameId', () => {
  assert.throws(() => multiplayerGames.setAnswerWindowSeconds('unknown-id', 'token', 30), /GAME_NOT_FOUND/);
});

test('setAnswerWindowSeconds throws NOT_HOST when the token does not match', () => {
  const game = createLobbyWithTwoPlayers();
  assert.throws(() => multiplayerGames.setAnswerWindowSeconds(game.gameId, 'wrong-token', 30), /NOT_HOST/);
});

test('setAnswerWindowSeconds throws GAME_NOT_IN_LOBBY once the game has started', () => {
  const game = createLobbyWithTwoPlayers();
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 1);
  assert.throws(() => multiplayerGames.setAnswerWindowSeconds(game.gameId, game.hostToken, 30), /GAME_NOT_IN_LOBBY/);
});

test('setAnswerWindowSeconds throws INVALID_ANSWER_WINDOW for 9, 301 and non-integer values', () => {
  const game = createLobbyWithTwoPlayers();
  assert.throws(() => multiplayerGames.setAnswerWindowSeconds(game.gameId, game.hostToken, 9), /INVALID_ANSWER_WINDOW/);
  assert.throws(() => multiplayerGames.setAnswerWindowSeconds(game.gameId, game.hostToken, 301), /INVALID_ANSWER_WINDOW/);
  assert.throws(() => multiplayerGames.setAnswerWindowSeconds(game.gameId, game.hostToken, 30.5), /INVALID_ANSWER_WINDOW/);
  assert.throws(() => multiplayerGames.setAnswerWindowSeconds(game.gameId, game.hostToken, 'abc'), /INVALID_ANSWER_WINDOW/);
});

test('startGame moves a lobby with 2+ players to in_progress, sets stage 1 and picks a song', () => {
  const game = createLobbyWithTwoPlayers();
  const started = multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  assert.equal(started.status, 'in_progress');
  assert.equal(started.stage, 1);
  assert.equal(started.songId, 42);
  assert.equal(started.songIndex, 1);
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

test('checkStageProgress skips straight to the end once everyone has found the song, without an intermediate advance', () => {
  const game = startedGameWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  // Both find it at stage 1 of a 6-stage song — nobody is left to answer at
  // any later stage, so the round should end immediately rather than
  // waiting out stages 2-6.
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.submitAnswer(game.gameId, bob.playerId, 'Correct Title', findSongByTitle, computeScore);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);

  assert.equal(result.type, 'ended');
  assert.equal(multiplayerGames.getGame(game.gameId).stage, 6);
  assert.equal(multiplayerGames.getGame(game.gameId).status, 'ended');
  const aliceResult = result.players.find((p) => p.playerId === alice.playerId);
  const bobResult = result.players.find((p) => p.playerId === bob.playerId);
  // Scores reflect the stage each player actually answered on (stage 1),
  // not the stage the game fast-forwarded to.
  assert.equal(aliceResult.score, computeScore(1));
  assert.equal(bobResult.score, computeScore(1));
});

test('checkStageProgress skips straight to the next song once everyone has found it, in a multi-song game', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.setSongCount(game.gameId, game.hostToken, 2);
  multiplayerGames.joinGame(game.gameId, 'Alice');
  multiplayerGames.joinGame(game.gameId, 'Bob');
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  const stored = multiplayerGames.getGame(game.gameId);
  const [alice, bob] = stored.players;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.submitAnswer(game.gameId, bob.playerId, 'Correct Title', findSongByTitle, computeScore);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6, () => 99);

  assert.equal(result.type, 'songAdvanced');
  assert.equal(result.songIndex, 2);
  assert.equal(stored.songId, 99);
  assert.equal(stored.stage, 1);
  assert.equal(stored.status, 'in_progress');
});

function gameRevealingNextSong() {
  const game = multiplayerGames.createGame();
  multiplayerGames.setSongCount(game.gameId, game.hostToken, 2);
  multiplayerGames.joinGame(game.gameId, 'Alice');
  multiplayerGames.joinGame(game.gameId, 'Bob');
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  const stored = multiplayerGames.getGame(game.gameId);
  for (const player of stored.players) {
    multiplayerGames.submitAnswer(game.gameId, player.playerId, 'Correct Title', findSongByTitle, computeScore);
  }
  multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6, () => 99);
  return stored;
}

test('submitAnswer throws SONG_REVEALING while the finished song is being revealed', () => {
  const game = gameRevealingNextSong();
  assert.throws(
    () => multiplayerGames.submitAnswer(game.gameId, game.players[0].playerId, 'Correct Title', findSongByTitle, computeScore),
    /SONG_REVEALING/
  );
});

test('forfeitStage throws SONG_REVEALING while the finished song is being revealed', () => {
  const game = gameRevealingNextSong();
  assert.throws(() => multiplayerGames.forfeitStage(game.gameId, game.players[0].playerId), /SONG_REVEALING/);
});

test('timeoutStage does nothing while the finished song is being revealed', () => {
  const game = gameRevealingNextSong();
  assert.deepEqual(multiplayerGames.timeoutStage(game.gameId, 1), []);
  assert.ok(game.players.every((p) => p.status === 'active'));
});

test('endReveal lets players act on the next song again', () => {
  const game = gameRevealingNextSong();
  multiplayerGames.endReveal(game.gameId);
  const result = multiplayerGames.forfeitStage(game.gameId, game.players[0].playerId);
  assert.equal(result.stage, 1);
});

test('checkStageProgress does not skip while a player is still forfeited (not everyone found)', () => {
  const game = startedGameWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);

  assert.equal(result.type, 'advanced');
  assert.equal(result.stage, 2);
});

test('checkStageProgress skips straight to the end once everyone has unanimously forfeited (backlog: skip on abandon)', () => {
  const game = startedGameWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  // Both give up at stage 1 — nobody found it and nobody is still trying,
  // so continuing to cycle through stages 2-6 offers nothing.
  multiplayerGames.forfeitStage(game.gameId, alice.playerId);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);

  assert.equal(result.type, 'ended');
  assert.equal(multiplayerGames.getGame(game.gameId).stage, 6);
  const aliceResult = result.players.find((p) => p.playerId === alice.playerId);
  const bobResult = result.players.find((p) => p.playerId === bob.playerId);
  assert.equal(aliceResult.score, 0);
  assert.equal(bobResult.score, 0);
});

test('checkStageProgress does not skip a solo remaining player who forfeits — that is their normal retry, not a group giving up', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  const [alice] = multiplayerGames.getGame(game.gameId).players;
  multiplayerGames.forfeitStage(game.gameId, alice.playerId);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);

  assert.equal(result.type, 'advanced');
  assert.equal(result.stage, 2);
  assert.equal(alice.status, 'active');
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

test('checkStageProgress moves to the next song once the last stage resolves and songIndex < songCount', () => {
  const game = createLobbyWithTwoPlayers();
  multiplayerGames.setSongCount(game.gameId, game.hostToken, 3);
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  const stored = multiplayerGames.getGame(game.gameId);
  stored.stage = 6; // last stage of song 1
  const [alice, bob] = stored.players;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);

  const result = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6, () => 99);

  assert.equal(result.type, 'songAdvanced');
  assert.equal(result.finishedSongId, 42);
  assert.equal(result.songIndex, 2);
  assert.equal(result.songCount, 3);
  assert.equal(result.stage, 1);
  const finishedAlice = result.finishedSongPlayers.find((p) => p.playerId === alice.playerId);
  assert.equal(finishedAlice.foundStage, 6);
  assert.equal(finishedAlice.score, computeScore(6));
  assert.equal(finishedAlice.totalScore, computeScore(6));
  const finishedBob = result.finishedSongPlayers.find((p) => p.playerId === bob.playerId);
  assert.equal(finishedBob.totalScore, 0);

  assert.equal(stored.status, 'in_progress');
  assert.equal(stored.songId, 99);
  assert.equal(stored.songIndex, 2);
  assert.equal(stored.stage, 1);
  assert.equal(alice.status, 'active');
  assert.equal(alice.foundStage, undefined);
  assert.equal(alice.score, undefined);
  assert.equal(alice.totalScore, computeScore(6));
  assert.equal(bob.status, 'active');
  assert.equal(bob.totalScore, 0);
});

test('checkStageProgress ends the game only once the last song of a multi-song game resolves, with totals across songs', () => {
  const game = createLobbyWithTwoPlayers();
  multiplayerGames.setSongCount(game.gameId, game.hostToken, 2);
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 42);
  const stored = multiplayerGames.getGame(game.gameId);
  const [alice, bob] = stored.players;
  // Matches whichever song is currently active, since checkStageProgress
  // picks a new songId for song 2 (submitAnswer requires matchedSong.id to
  // equal the game's *current* songId).
  const findCurrentSongByTitle = (title) => (title === 'Correct Title' ? { id: stored.songId, title } : null);

  // Song 1: Alice finds it at stage 6, Bob never finds it.
  stored.stage = 6;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findCurrentSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);
  const songOneResult = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6, () => 43);
  assert.equal(songOneResult.type, 'songAdvanced');
  multiplayerGames.endReveal(game.gameId);

  // Song 2: Bob finds it at stage 6, Alice never finds it.
  stored.stage = 6;
  multiplayerGames.submitAnswer(game.gameId, bob.playerId, 'Correct Title', findCurrentSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, alice.playerId);
  const songTwoResult = multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6, () => 44);

  assert.equal(songTwoResult.type, 'ended');
  assert.equal(songTwoResult.songId, 43);
  assert.equal(stored.status, 'ended');
  const finalAlice = songTwoResult.players.find((p) => p.playerId === alice.playerId);
  const finalBob = songTwoResult.players.find((p) => p.playerId === bob.playerId);
  assert.equal(finalAlice.score, computeScore(6));
  assert.equal(finalBob.score, computeScore(6));
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

function endedGameWithTwoPlayers() {
  const game = startedGameWithTwoPlayers();
  const stored = multiplayerGames.getGame(game.gameId);
  const [alice, bob] = stored.players;
  multiplayerGames.submitAnswer(game.gameId, alice.playerId, 'Correct Title', findSongByTitle, computeScore);
  multiplayerGames.forfeitStage(game.gameId, bob.playerId);
  stored.stage = 6;
  multiplayerGames.checkStageProgress(game.gameId, durationForStage, 6);
  return { gameId: game.gameId, alice, bob };
}

test('confirmReturnToLobby resets the game and marks the caller returned, others waiting', () => {
  const { gameId, alice, bob } = endedGameWithTwoPlayers();
  const game = multiplayerGames.confirmReturnToLobby(gameId, alice.playerId);

  assert.equal(game.status, 'lobby');
  assert.equal(game.stage, 0);
  assert.equal(game.songId, undefined);
  assert.equal(game.songIndex, undefined);
  assert.equal(game.stageStartedAt, undefined);
  assert.equal(alice.status, 'active');
  assert.equal(alice.returnedToLobby, true);
  assert.equal(alice.foundStage, undefined);
  assert.equal(alice.score, undefined);
  assert.equal(alice.totalScore, undefined);
  assert.equal(bob.status, 'active');
  assert.equal(bob.returnedToLobby, false);
  assert.equal(bob.forfeitReason, undefined);
});

test('confirmReturnToLobby from a second player only marks that player, once the game is already lobby', () => {
  const { gameId, alice, bob } = endedGameWithTwoPlayers();
  multiplayerGames.confirmReturnToLobby(gameId, alice.playerId);
  multiplayerGames.confirmReturnToLobby(gameId, bob.playerId);

  assert.equal(alice.returnedToLobby, true);
  assert.equal(bob.returnedToLobby, true);
  assert.equal(multiplayerGames.getGame(gameId).status, 'lobby');
});

test('confirmReturnToLobby throws GAME_NOT_FOUND for an unknown gameId', () => {
  assert.throws(() => multiplayerGames.confirmReturnToLobby('unknown-game', 'p1'), /GAME_NOT_FOUND/);
});

test('confirmReturnToLobby throws PLAYER_NOT_FOUND for an unknown playerId', () => {
  const { gameId } = endedGameWithTwoPlayers();
  assert.throws(() => multiplayerGames.confirmReturnToLobby(gameId, 'unknown-player'), /PLAYER_NOT_FOUND/);
});

test('confirmReturnToLobby throws GAME_NOT_ENDED while the game is still in progress', () => {
  const game = startedGameWithTwoPlayers();
  const alice = multiplayerGames.getGame(game.gameId).players[0];
  assert.throws(() => multiplayerGames.confirmReturnToLobby(game.gameId, alice.playerId), /GAME_NOT_ENDED/);
});

test('kickPlayer removes the targeted player from the lobby', () => {
  const game = createLobbyWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  multiplayerGames.kickPlayer(game.gameId, game.hostToken, alice.playerId, bob.playerId);
  const stored = multiplayerGames.getGame(game.gameId);
  assert.equal(stored.players.length, 1);
  assert.equal(stored.players[0].playerId, alice.playerId);
});

test('kickPlayer throws GAME_NOT_FOUND for an unknown gameId', () => {
  assert.throws(
    () => multiplayerGames.kickPlayer('unknown-game', 'token', 'p1', 'p2'),
    /GAME_NOT_FOUND/
  );
});

test('kickPlayer throws NOT_HOST when the token does not match', () => {
  const game = createLobbyWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  assert.throws(
    () => multiplayerGames.kickPlayer(game.gameId, 'wrong-token', alice.playerId, bob.playerId),
    /NOT_HOST/
  );
});

test('kickPlayer throws GAME_NOT_IN_LOBBY once the game has started', () => {
  const game = createLobbyWithTwoPlayers();
  const [alice, bob] = multiplayerGames.getGame(game.gameId).players;
  multiplayerGames.startGame(game.gameId, game.hostToken, () => 1);
  assert.throws(
    () => multiplayerGames.kickPlayer(game.gameId, game.hostToken, alice.playerId, bob.playerId),
    /GAME_NOT_IN_LOBBY/
  );
});

test('kickPlayer throws CANNOT_KICK_SELF when the host targets their own playerId', () => {
  const game = createLobbyWithTwoPlayers();
  const [alice] = multiplayerGames.getGame(game.gameId).players;
  assert.throws(
    () => multiplayerGames.kickPlayer(game.gameId, game.hostToken, alice.playerId, alice.playerId),
    /CANNOT_KICK_SELF/
  );
});

test('kickPlayer throws PLAYER_NOT_FOUND for an unknown targetPlayerId', () => {
  const game = createLobbyWithTwoPlayers();
  const [alice] = multiplayerGames.getGame(game.gameId).players;
  assert.throws(
    () => multiplayerGames.kickPlayer(game.gameId, game.hostToken, alice.playerId, 'unknown-player'),
    /PLAYER_NOT_FOUND/
  );
});

test('joinGame links the joining player as host when the hostToken matches', () => {
  const game = multiplayerGames.createGame();
  const { playerId } = multiplayerGames.joinGame(game.gameId, 'Alice', game.hostToken);
  assert.equal(multiplayerGames.getGame(game.gameId).hostPlayerId, playerId);
});

test('joinGame does not link a player as host without a matching hostToken', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice');
  multiplayerGames.joinGame(game.gameId, 'Bob', 'wrong-token');
  assert.equal(multiplayerGames.getGame(game.gameId).hostPlayerId, undefined);
});

test('joinGame does not let a later join overwrite an already-claimed host slot', () => {
  const game = multiplayerGames.createGame();
  const { playerId: aliceId } = multiplayerGames.joinGame(game.gameId, 'Alice', game.hostToken);
  multiplayerGames.joinGame(game.gameId, 'Bob', game.hostToken);
  assert.equal(multiplayerGames.getGame(game.gameId).hostPlayerId, aliceId);
});

test('reassignHostIfNeeded promotes the oldest remaining player and rotates hostToken', () => {
  const game = multiplayerGames.createGame();
  const originalToken = game.hostToken;
  const { playerId: aliceId } = multiplayerGames.joinGame(game.gameId, 'Alice', game.hostToken);
  const { playerId: bobId } = multiplayerGames.joinGame(game.gameId, 'Bob');
  multiplayerGames.removePlayer(game.gameId, aliceId);

  const result = multiplayerGames.reassignHostIfNeeded(game.gameId, aliceId);

  assert.equal(result.hostPlayerId, bobId);
  assert.notEqual(result.hostToken, originalToken);
  const stored = multiplayerGames.getGame(game.gameId);
  assert.equal(stored.hostPlayerId, bobId);
  assert.equal(stored.hostToken, result.hostToken);
});

test('reassignHostIfNeeded returns null when the removed player was not the host', () => {
  const game = multiplayerGames.createGame();
  multiplayerGames.joinGame(game.gameId, 'Alice', game.hostToken);
  const { playerId: bobId } = multiplayerGames.joinGame(game.gameId, 'Bob');
  multiplayerGames.removePlayer(game.gameId, bobId);

  assert.equal(multiplayerGames.reassignHostIfNeeded(game.gameId, bobId), null);
});

test('reassignHostIfNeeded returns null once the game itself has been purged', () => {
  const game = multiplayerGames.createGame();
  const { playerId: aliceId } = multiplayerGames.joinGame(game.gameId, 'Alice', game.hostToken);
  multiplayerGames.removePlayer(game.gameId, aliceId); // last player — purges the game

  assert.equal(multiplayerGames.reassignHostIfNeeded(game.gameId, aliceId), null);
});
