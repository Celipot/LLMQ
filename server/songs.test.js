const { test } = require('node:test');
const assert = require('node:assert/strict');
const songs = require('./songs');

test('getPlayableTitles returns {title, artist} entries from data/songs.json', () => {
  const titles = songs.getPlayableTitles();
  assert.ok(Array.isArray(titles));
  assert.ok(titles.some((t) => t.title === songs.randomSong.title && t.artist === songs.randomSong.artist));
});

test('findSongByTitle matches case-insensitively', () => {
  const found = songs.findSongByTitle(songs.randomSong.title.toUpperCase());
  assert.equal(found.id, songs.randomSong.id);
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
  const found = songs.findSongByTitle(`  ${songs.randomSong.title}  `);
  assert.equal(found.id, songs.randomSong.id);
});
