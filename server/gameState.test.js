const { test } = require('node:test');
const assert = require('node:assert/strict');
const gameState = require('./gameState');

const CORRECT_SONG = { title: 'Correct Title', artist: 'Correct Artist', coverUrl: '/covers/correct.png' };

let keyCounter = 0;
function freshKey() {
  keyCounter += 1;
  return `test:${keyCounter}`;
}

test('starts at tier 0 with 1 allowed second and no guesses', () => {
  const state = gameState.getPublicState(freshKey(), CORRECT_SONG);
  assert.equal(state.attemptsUsed, 0);
  assert.equal(state.allowedSeconds, 1);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.guesses, []);
  assert.equal(state.correctTitle, undefined);
});

test('wrong guess advances the tier and does not finish the game', () => {
  const key = freshKey();
  gameState.applyGuess(key, 'Wrong Title', false);
  const state = gameState.getPublicState(key);
  assert.equal(state.attemptsUsed, 1);
  assert.equal(state.allowedSeconds, gameState.TIERS_SECONDS[1]);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.guesses, [{ type: 'guess', title: 'Wrong Title', correct: false }]);
});

test('correct guess wins immediately regardless of attempts used', () => {
  const key = freshKey();
  gameState.applyGuess(key, 'Wrong Title', false);
  gameState.applyGuess(key, 'Correct Title', true);
  const state = gameState.getPublicState(key, CORRECT_SONG);
  assert.equal(state.status, 'won');
  assert.equal(state.correctTitle, 'Correct Title');
  assert.equal(state.correctArtist, 'Correct Artist');
  assert.equal(state.correctCoverUrl, '/covers/correct.png');
});

test('6th failed attempt loses the game and reveals the title', () => {
  const key = freshKey();
  for (let i = 0; i < gameState.MAX_ATTEMPTS; i++) {
    gameState.applyGuess(key, 'Wrong Title', false);
  }
  const state = gameState.getPublicState(key, CORRECT_SONG);
  assert.equal(state.status, 'lost');
  assert.equal(state.correctTitle, 'Correct Title');
});

test('a finished round reveals the id of the correct song, a playing one does not', () => {
  const key = freshKey();
  assert.equal(gameState.getPublicState(key, { ...CORRECT_SONG, id: 42 }).correctSongId, undefined);
  gameState.applyGuess(key, 'Correct Title', true);
  assert.equal(gameState.getPublicState(key, { ...CORRECT_SONG, id: 42 }).correctSongId, 42);
});

test('applyGuess throws once the game is finished', () => {
  const key = freshKey();
  gameState.applyGuess(key, 'Correct Title', true);
  assert.throws(() => gameState.applyGuess(key, 'Another Title', false), /GAME_FINISHED/);
});

test('applySkip advances the tier and throws once the game is finished', () => {
  const key = freshKey();
  for (let i = 0; i < gameState.MAX_ATTEMPTS - 1; i++) {
    gameState.applySkip(key);
  }
  assert.equal(gameState.getPublicState(key).attemptsUsed, gameState.MAX_ATTEMPTS - 1);
  gameState.applySkip(key);
  assert.equal(gameState.getPublicState(key).status, 'lost');
  assert.throws(() => gameState.applySkip(key), /GAME_FINISHED/);
});

test('resetState clears an existing round back to its initial state', () => {
  const key = freshKey();
  gameState.applyGuess(key, 'Correct Title', true);
  gameState.resetState(key);
  const state = gameState.getPublicState(key);
  assert.equal(state.attemptsUsed, 0);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.guesses, []);
});

test('getStatus is not_started for a key that was never touched', () => {
  assert.equal(gameState.getStatus(freshKey()), 'not_started');
});

test('getStatus reflects the round status once it has been read via getPublicState', () => {
  const key = freshKey();
  gameState.getPublicState(key);
  assert.equal(gameState.getStatus(key), 'playing');
});

test('two different keys keep fully independent state', () => {
  const keyA = freshKey();
  const keyB = freshKey();
  gameState.applyGuess(keyA, 'Wrong Title', false);
  assert.equal(gameState.getPublicState(keyA).attemptsUsed, 1);
  assert.equal(gameState.getPublicState(keyB).attemptsUsed, 0);
});

test('score rewards an earlier stage with more points', () => {
  assert.equal(gameState.score(1), 6);
  assert.equal(gameState.score(2), 5);
  assert.equal(gameState.score(gameState.MAX_ATTEMPTS), 1);
});
