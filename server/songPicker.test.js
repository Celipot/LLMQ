const { test } = require('node:test');
const assert = require('node:assert/strict');
const songPicker = require('./songPicker');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 31);
const LONG_AGO = NOW - 30 * DAY_MS;

function stat(plays, wins, stageSum, lastPlayedAt = LONG_AGO) {
  return { plays, wins, stageSum, lastPlayedAt };
}

test('a song that was never played has a neutral difficulty of 0.5', () => {
  assert.equal(songPicker.difficulty(undefined), 0.5);
});

test('a song lost more often weighs more than one found more often', () => {
  const found = stat(4, 4, 8);
  const lost = stat(4, 1, 8);
  assert.ok(songPicker.weight(lost, NOW) > songPicker.weight(found, NOW));
});

test('at the same success rate, a song found at a later stage weighs more', () => {
  const early = stat(4, 4, 4);
  const late = stat(4, 4, 20);
  assert.ok(songPicker.weight(late, NOW) > songPicker.weight(early, NOW));
});

test('a single result barely moves the difficulty away from neutral', () => {
  const oneEasyWin = songPicker.difficulty(stat(1, 1, 1));
  const oneLoss = songPicker.difficulty(stat(1, 0, 0));
  assert.ok(oneEasyWin > 0.3 && oneEasyWin < 0.5);
  assert.ok(oneLoss > 0.5 && oneLoss < 0.7);
});

test('a song played long ago weighs more than one played a few days ago', () => {
  const recent = stat(3, 2, 6, NOW - 2 * DAY_MS);
  const due = stat(3, 2, 6, NOW - 20 * DAY_MS);
  assert.ok(songPicker.weight(due, NOW) > songPicker.weight(recent, NOW));
});

test('a song played within the cooldown has no chance to be drawn', () => {
  assert.equal(songPicker.weight(stat(3, 2, 6, NOW - 60 * 1000), NOW), 0);
});

test('a song never played keeps a sizeable weight', () => {
  const unseen = songPicker.weight(undefined, NOW);
  assert.ok(unseen > songPicker.weight(stat(4, 4, 4), NOW));
});

test('pickWeightedSongId only returns songs of the pool', () => {
  for (let i = 0; i < 50; i += 1) {
    assert.ok([1, 2, 3].includes(songPicker.pickWeightedSongId([1, 2, 3], {}, NOW)));
  }
});

test('pickWeightedSongId follows the weights', () => {
  const history = { 1: stat(6, 6, 6), 2: stat(6, 0, 0) };
  const alwaysLow = () => 0;
  const alwaysHigh = () => 0.999999;
  const w1 = songPicker.weight(history[1], NOW);
  const w2 = songPicker.weight(history[2], NOW);
  assert.ok(w2 > w1);
  assert.equal(songPicker.pickWeightedSongId([1, 2], history, NOW, alwaysLow), 1);
  assert.equal(songPicker.pickWeightedSongId([1, 2], history, NOW, alwaysHigh), 2);
});

test('pickWeightedSongId skips songs in cooldown', () => {
  const history = { 1: stat(1, 1, 1, NOW - 1000), 2: stat(1, 1, 1, NOW - 1000) };
  for (let i = 0; i < 30; i += 1) {
    assert.equal(songPicker.pickWeightedSongId([1, 2, 3], history, NOW), 3);
  }
});

test('pickWeightedSongId falls back to a uniform draw when the whole pool is in cooldown', () => {
  const history = { 1: stat(1, 1, 1, NOW - 1000), 2: stat(1, 1, 1, NOW - 1000) };
  const picked = songPicker.pickWeightedSongId([1, 2], history, NOW, () => 0.75);
  assert.equal(picked, 2);
});

test('sanitizeHistory keeps well-formed entries of known songs', () => {
  const clean = songPicker.sanitizeHistory({ 1: stat(3, 2, 5) }, (id) => id === 1, NOW);
  assert.deepEqual(clean, { 1: stat(3, 2, 5) });
});

test('sanitizeHistory drops unknown songs and malformed entries', () => {
  const raw = {
    1: stat(3, 2, 5),
    2: stat(3, 2, 5),
    3: stat(2, 3, 3),
    4: stat(3, 2, 99),
    5: { plays: 'x', wins: 1, stageSum: 1, lastPlayedAt: 1 },
    6: stat(-1, 0, 0),
  };
  const clean = songPicker.sanitizeHistory(raw, (id) => id !== 2, NOW);
  assert.deepEqual(Object.keys(clean), ['1']);
});

test('sanitizeHistory clamps a last-played date in the future to now', () => {
  const clean = songPicker.sanitizeHistory({ 1: stat(1, 1, 1, NOW + 10 * DAY_MS) }, () => true, NOW);
  assert.equal(clean[1].lastPlayedAt, NOW);
});

test('sanitizeHistory rejects anything that is not a plain object', () => {
  for (const raw of ['x', 3, null, [], undefined]) {
    assert.equal(songPicker.sanitizeHistory(raw, () => true, NOW), null);
  }
});
