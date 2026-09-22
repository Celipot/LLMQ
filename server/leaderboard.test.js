const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const leaderboard = require('./leaderboard');

let dir;
let file;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llmq-leaderboard-'));
  file = path.join(dir, 'leaderboard.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const entry = (username, score, turn = 60, grade = 'B', generation) => ({ username, turn, score, grade, generation });

describe('the leaderboard', () => {
  test('is empty when there is no file yet', () => {
    assert.deepEqual(leaderboard.createLeaderboard(file).top(), []);
  });

  test('lists the best scores first, the earlier one first on a tie', () => {
    const board = leaderboard.createLeaderboard(file);
    board.submit(entry('Kasumi', 100));
    board.submit(entry('Ayumu', 300));
    board.submit(entry('Setsuna', 100));
    assert.deepEqual(board.top().map((row) => row.username), ['Ayumu', 'Kasumi', 'Setsuna']);
  });

  test('shows the username, the turn, the score and the grade of a run', () => {
    const board = leaderboard.createLeaderboard(file);
    board.submit(entry('Ayumu', 18240, 63, 'A'));
    assert.deepEqual(board.top(), [{ username: 'Ayumu', turn: 63, score: 18240, grade: 'A' }]);
  });

  test('shows the 10 best runs and keeps the 100 best on disk', () => {
    const board = leaderboard.createLeaderboard(file);
    for (let i = 0; i < 105; i += 1) board.submit(entry(`p${i}`, i));
    assert.equal(board.top().length, 10);
    assert.equal(board.top()[0].score, 104);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 100);
  });

  test('is remembered by the next instance reading the same file', () => {
    leaderboard.createLeaderboard(file).submit(entry('Ayumu', 300));
    assert.deepEqual(leaderboard.createLeaderboard(file).top().map((row) => row.username), ['Ayumu']);
  });

  test('starts empty from a corrupted file and can still be written', () => {
    fs.writeFileSync(file, '{not json');
    const board = leaderboard.createLeaderboard(file);
    assert.deepEqual(board.top(), []);
    board.submit(entry('Ayumu', 300));
    assert.equal(leaderboard.createLeaderboard(file).top().length, 1);
  });

  test('ignores the malformed entries of the file', () => {
    fs.writeFileSync(file, JSON.stringify([entry('Ayumu', 300), { username: 5 }, null, entry('Kasumi', 'x')]));
    assert.deepEqual(leaderboard.createLeaderboard(file).top().map((row) => row.username), ['Ayumu']);
  });
});

describe('per-generation boards', () => {
  test('top(size, generation) only lists the runs of that generation', () => {
    const board = leaderboard.createLeaderboard(file);
    board.submit(entry('Ayumu', 100, 60, 'B', 'nijigasaki'));
    board.submit(entry('Honoka', 200, 60, 'B', 'mus'));
    board.submit(entry('Chika', 300, 60, 'B', 'aqours'));
    assert.deepEqual(board.top(10, 'nijigasaki').map((row) => row.username), ['Ayumu']);
    assert.deepEqual(board.top(10, 'mus').map((row) => row.username), ['Honoka']);
    assert.deepEqual(board.top(10, 'hasunosora'), []);
  });

  test('an entry without a generation is read as nijigasaki', () => {
    fs.writeFileSync(file, JSON.stringify([{ username: 'Ayumu', turn: 60, score: 300, grade: 'B' }]));
    const board = leaderboard.createLeaderboard(file);
    assert.deepEqual(board.top(10, 'nijigasaki').map((row) => row.username), ['Ayumu']);
    assert.deepEqual(board.top(10, 'aqours'), []);
  });

  test('topByGeneration returns the 7 boards at once', () => {
    const board = leaderboard.createLeaderboard(file);
    board.submit(entry('Ayumu', 100, 60, 'B', 'nijigasaki'));
    board.submit(entry('Chika', 300, 60, 'B', 'aqours'));
    board.submit(entry('Kanon', 400, 60, 'B', 'liella'));
    board.submit(entry('Everyone', 50, 60, 'B', 'all'));
    assert.deepEqual(Object.keys(board.topByGeneration()), [
      'nijigasaki',
      'mus',
      'aqours',
      'hasunosora',
      'liella',
      'ikizulive',
      'all',
    ]);
    assert.deepEqual(board.topByGeneration().aqours.map((row) => row.username), ['Chika']);
    assert.deepEqual(board.topByGeneration().liella.map((row) => row.username), ['Kanon']);
    assert.deepEqual(board.topByGeneration().mus, []);
    assert.deepEqual(board.topByGeneration().ikizulive, []);
  });

  test('a busy generation never pushes another one out of the 100 kept on disk', () => {
    const board = leaderboard.createLeaderboard(file);
    for (let i = 0; i < 105; i += 1) board.submit(entry(`p${i}`, i, 60, 'B', 'nijigasaki'));
    board.submit(entry('Chika', 999, 60, 'B', 'aqours'));
    assert.equal(board.top(10, 'aqours').length, 1);
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(onDisk.filter((row) => row.generation === 'nijigasaki').length, 100);
    assert.equal(onDisk.filter((row) => row.generation === 'aqours').length, 1);
  });
});

describe('isValidUsername', () => {
  test('accepts 1 to 20 characters once trimmed', () => {
    assert.equal(leaderboard.isValidUsername('Ayumu'), true);
    assert.equal(leaderboard.isValidUsername('a'.repeat(20)), true);
    assert.equal(leaderboard.isValidUsername('  Ayumu  '), true);
  });

  test('refuses an empty, blank, too long or non-string username', () => {
    assert.equal(leaderboard.isValidUsername(''), false);
    assert.equal(leaderboard.isValidUsername('   '), false);
    assert.equal(leaderboard.isValidUsername('a'.repeat(21)), false);
    assert.equal(leaderboard.isValidUsername(42), false);
    assert.equal(leaderboard.isValidUsername(undefined), false);
  });
});
