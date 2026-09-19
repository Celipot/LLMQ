// Loads the playable song library from data/songs.json.
const fs = require('fs');
const path = require('path');

const SONGS_PATH = path.join(__dirname, '..', 'data', 'songs.json');
const AUDIO_DIR = path.join(__dirname, '..', 'data', 'audio');

const songs = JSON.parse(fs.readFileSync(SONGS_PATH, 'utf8'));

const GENERATIONS = ["µ's", 'Aqours', 'Nijigasaki', 'Liella', 'Hasunosora', 'Ikizulive', 'Musical', 'CrossGen'];

function getPoolIds(generations = GENERATIONS) {
  return songs.filter((song) => generations.includes(song.generation)).map((song) => song.id);
}

function pickRandomSongId(generations = GENERATIONS) {
  const pool = getPoolIds(generations);
  return pool[Math.floor(Math.random() * pool.length)];
}

function getGenerations() {
  return GENERATIONS.map((generation) => ({
    generation,
    count: songs.filter((song) => song.generation === generation).length,
  }));
}

function isValidGenerationSelection(selection) {
  return (
    Array.isArray(selection) && selection.length > 0 && selection.every((generation) => GENERATIONS.includes(generation))
  );
}

function getSongById(id) {
  return songs.find((song) => song.id === id) || null;
}

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .trim();
}

function getPlayableTitles() {
  return songs.map((song) => ({ id: song.id, title: song.title, artist: song.artist }));
}

function findSongByTitle(title) {
  const target = normalize(title);
  return songs.find((song) => normalize(song.title) === target) || null;
}

function getAudioPath(id) {
  const song = getSongById(id);
  return path.join(AUDIO_DIR, song.audioFile);
}

module.exports = {
  pickRandomSongId,
  getPoolIds,
  getGenerations,
  isValidGenerationSelection,
  getSongById,
  normalize,
  getPlayableTitles,
  findSongByTitle,
  getAudioPath,
};
