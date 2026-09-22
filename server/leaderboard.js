// Global leaderboard of the infinite career: the best runs of every player, kept in a
// JSON file so that they survive a restart of the server.

const fs = require('node:fs');
const path = require('node:path');

const MAX_ENTRIES = 100;
const TOP_SIZE = 10;
const MAX_USERNAME_LENGTH = 20;
const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'leaderboard.json');
// The 6 franchises plus 'all' (the whole library): every run is entered in exactly one
// board. Entries written before this board existed have no generation: read as Nijigasaki,
// since that was the only franchise the infinite mode could follow at the time.
const GENERATIONS = ['nijigasaki', 'mus', 'aqours', 'hasunosora', 'liella', 'ikizulive', 'all'];
const DEFAULT_GENERATION = 'nijigasaki';

function normalizeGeneration(generation) {
  return GENERATIONS.includes(generation) ? generation : DEFAULT_GENERATION;
}

function isValidUsername(username) {
  return typeof username === 'string' && username.trim().length > 0 && username.trim().length <= MAX_USERNAME_LENGTH;
}

function isValidEntry(entry) {
  return (
    Boolean(entry) &&
    typeof entry.username === 'string' &&
    Number.isFinite(entry.turn) &&
    Number.isFinite(entry.score) &&
    typeof entry.grade === 'string'
  );
}

function readEntries(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

// Written to a temporary file first so that a crash never leaves a half-written board.
// A failed write keeps the board in memory rather than losing the run.
function writeEntries(file, entries) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(entries));
    fs.renameSync(`${file}.tmp`, file);
  } catch (error) {
    console.error('Leaderboard not saved:', error.message);
  }
}

// Trims each generation's own entries to MAX_ENTRIES, rather than the whole file, so a
// franchise played less often is never pushed out by the runs of a busier one.
function trim(entries) {
  return GENERATIONS.flatMap((generation) =>
    entries
      .filter((entry) => normalizeGeneration(entry.generation) === generation)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES),
  );
}

function createLeaderboard(file) {
  let entries = readEntries(file);
  return {
    submit({ username, turn, score, grade, generation }) {
      entries = trim([...entries, { username, turn, score, grade, generation: normalizeGeneration(generation) }]);
      writeEntries(file, entries);
    },
    // Array.prototype.sort is stable: on a tie the earlier run stays first.
    top(size = TOP_SIZE, generation) {
      const pool = generation ? entries.filter((entry) => normalizeGeneration(entry.generation) === generation) : entries;
      return [...pool]
        .sort((a, b) => b.score - a.score)
        .slice(0, size)
        .map(({ username, turn, score, grade }) => ({ username, turn, score, grade }));
    },
    topByGeneration(size = TOP_SIZE) {
      return Object.fromEntries(GENERATIONS.map((generation) => [generation, this.top(size, generation)]));
    },
  };
}

// Created on first use so that a test can point LEADERBOARD_FILE elsewhere.
let shared;
function sharedLeaderboard() {
  shared ??= createLeaderboard(process.env.LEADERBOARD_FILE ?? DEFAULT_FILE);
  return shared;
}

module.exports = {
  MAX_USERNAME_LENGTH,
  isValidUsername,
  createLeaderboard,
  submit: (entry) => sharedLeaderboard().submit(entry),
  top: (size, generation) => sharedLeaderboard().top(size, generation),
  topByGeneration: (size) => sharedLeaderboard().topByGeneration(size),
};
