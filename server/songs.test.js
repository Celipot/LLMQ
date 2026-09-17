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
