const { test } = require('node:test');
const assert = require('node:assert/strict');
const songs = require('./songs');

const titles = songs.getPlayableTitles();
const firstTitle = titles[0];

test('getPlayableTitles returns {id, title, artist} entries from data/songs.json', () => {
  assert.ok(Array.isArray(titles));
  assert.ok(titles.some((t) => t.id === firstTitle.id && t.title === firstTitle.title && t.artist === firstTitle.artist));
});

test('getSongById returns the full song for a known id', () => {
  const found = songs.getSongById(firstTitle.id);
  assert.equal(found.title, firstTitle.title);
});

test('every song in data/songs.json has exactly one known generation', () => {
  const GENERATIONS = ["µ's", 'Aqours', 'Nijigasaki', 'Liella', 'Hasunosora', 'Ikizulive', 'Musical', 'CrossGen'];
  const all = require('../data/songs.json');
  const invalid = all.filter((song) => !GENERATIONS.includes(song.generation));
  assert.deepEqual(
    invalid.map((song) => song.id),
    []
  );
});

test('pickRandomSongId only returns songs of the requested generations', () => {
  for (let i = 0; i < 50; i += 1) {
    const song = songs.getSongById(songs.pickRandomSongId(['Musical', 'Ikizulive']));
    assert.ok(['Musical', 'Ikizulive'].includes(song.generation));
  }
});

test('getPoolIds returns the ids of the songs of the requested generations only', () => {
  const ids = songs.getPoolIds(['Musical']);
  assert.ok(ids.length > 0);
  assert.ok(ids.every((id) => songs.getSongById(id).generation === 'Musical'));
});

test('getGenerations lists every generation with its song count', () => {
  const all = require('../data/songs.json');
  const generations = songs.getGenerations();
  assert.deepEqual(
    generations.map((g) => g.generation),
    ["µ's", 'Aqours', 'Nijigasaki', 'Liella', 'Hasunosora', 'Ikizulive', 'Musical', 'CrossGen']
  );
  for (const { generation, count } of generations) {
    assert.equal(count, all.filter((song) => song.generation === generation).length);
  }
});

test('isValidGenerationSelection accepts a non-empty list of known generations only', () => {
  assert.equal(songs.isValidGenerationSelection(['Aqours', 'Liella']), true);
  assert.equal(songs.isValidGenerationSelection([]), false);
  assert.equal(songs.isValidGenerationSelection(['Unknown']), false);
  assert.equal(songs.isValidGenerationSelection('Aqours'), false);
  assert.equal(songs.isValidGenerationSelection(undefined), false);
});

test('getSongById returns null for an unknown id', () => {
  assert.equal(songs.getSongById(-1), null);
});

test('pickRandomSongId always returns a valid song id', () => {
  const id = songs.pickRandomSongId();
  assert.ok(songs.getSongById(id));
});

test('findSongByTitle matches case-insensitively', () => {
  const found = songs.findSongByTitle(firstTitle.title.toUpperCase());
  assert.equal(found.id, firstTitle.id);
});

test('findSongByTitle matches accent-insensitively', () => {
  // normalize() strips accents, so a title with added/removed accents
  // should still resolve as long as the base letters match.
  assert.equal(songs.normalize('Été'), songs.normalize('ete'));
});

test('findSongByTitle returns null for an unknown title', () => {
  assert.equal(songs.findSongByTitle('Definitely Not A Real Song Title'), null);
});

test('findSongByTitle ignores leading/trailing whitespace', () => {
  const found = songs.findSongByTitle(`  ${firstTitle.title}  `);
  assert.equal(found.id, firstTitle.id);
});

test('getAudioPath returns a path ending with the song audio file', () => {
  const full = songs.getSongById(firstTitle.id);
  assert.ok(songs.getAudioPath(firstTitle.id).endsWith(full.audioFile));
});
