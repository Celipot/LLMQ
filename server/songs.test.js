const { test } = require('node:test');
const assert = require('node:assert/strict');
const songs = require('./songs');

test('getPlayableTitles returns the titles from data/songs.json', () => {
  const titles = songs.getPlayableTitles();
  assert.ok(Array.isArray(titles));
  assert.ok(titles.includes(songs.todaysSong.title));
});

test('findSongByTitle matches case-insensitively', () => {
  const found = songs.findSongByTitle(songs.todaysSong.title.toUpperCase());
  assert.equal(found.id, songs.todaysSong.id);
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
  const found = songs.findSongByTitle(`  ${songs.todaysSong.title}  `);
  assert.equal(found.id, songs.todaysSong.id);
});
