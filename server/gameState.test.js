const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const gameState = require('./gameState');

beforeEach(() => {
  gameState.reset();
});

test('starts at tier 0 with 1 allowed second and no guesses', () => {
  const state = gameState.getPublicState('Correct Title');
  assert.equal(state.attemptsUsed, 0);
  assert.equal(state.allowedSeconds, 1);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.guesses, []);
  assert.equal(state.correctTitle, undefined);
});

test('wrong guess advances the tier and does not finish the game', () => {
  gameState.applyGuess('Wrong Title', false);
  const state = gameState.getPublicState();
  assert.equal(state.attemptsUsed, 1);
  assert.equal(state.allowedSeconds, gameState.TIERS_SECONDS[1]);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.guesses, [{ type: 'guess', title: 'Wrong Title', correct: false }]);
});

test('correct guess wins immediately regardless of attempts used', () => {
  gameState.applyGuess('Wrong Title', false);
  gameState.applyGuess('Correct Title', true);
  const state = gameState.getPublicState('Correct Title');
  assert.equal(state.status, 'won');
  assert.equal(state.correctTitle, 'Correct Title');
});

test('6th failed attempt loses the game and reveals the title', () => {
  for (let i = 0; i < gameState.MAX_ATTEMPTS; i++) {
    gameState.applyGuess('Wrong Title', false);
  }
  const state = gameState.getPublicState('Correct Title');
  assert.equal(state.status, 'lost');
  assert.equal(state.attemptsUsed, gameState.MAX_ATTEMPTS);
  assert.equal(state.correctTitle, 'Correct Title');
});

test('skip advances the tier like a wrong guess but is not a guess entry', () => {
  gameState.applySkip();
  const state = gameState.getPublicState();
  assert.equal(state.attemptsUsed, 1);
  assert.deepEqual(state.guesses, [{ type: 'skip', title: null, correct: null }]);
});

test('skip on the last attempt loses the game', () => {
  for (let i = 0; i < gameState.MAX_ATTEMPTS - 1; i++) {
    gameState.applySkip();
  }
  assert.equal(gameState.isFinished(), false);
  gameState.applySkip();
  assert.equal(gameState.isFinished(), true);
  assert.equal(gameState.getPublicState().status, 'lost');
});

test('guess and skip both throw once the game is finished', () => {
  gameState.applyGuess('Correct Title', true);
  assert.throws(() => gameState.applyGuess('Anything', false), /GAME_FINISHED/);
  assert.throws(() => gameState.applySkip(), /GAME_FINISHED/);
});

test('correctTitle is never included while the game is still playing', () => {
  gameState.applyGuess('Wrong Title', false);
  const state = gameState.getPublicState('Correct Title');
  assert.equal(state.correctTitle, undefined);
});

test('reset clears attempts, guesses, status, and tier', () => {
  gameState.applyGuess('Wrong Title', false);
  gameState.applyGuess('Wrong Title', false);
  const state = gameState.reset();
  assert.equal(state.attemptsUsed, 0);
  assert.equal(state.allowedSeconds, 1);
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.guesses, []);
});
