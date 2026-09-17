// Loads the playable song library from data/songs.json.
// MVP has a single fixed song, but everything here is shaped for a list
// so multi-song support later doesn't require touching the API surface.
const fs = require('fs');
const path = require('path');

const SONGS_PATH = path.join(__dirname, '..', 'data', 'songs.json');
const AUDIO_DIR = path.join(__dirname, '..', 'data', 'audio');

const songs = JSON.parse(fs.readFileSync(SONGS_PATH, 'utf8'));

function pickRandomSong() {
  return songs[Math.floor(Math.random() * songs.length)];
}

// Mutable so a new song can be picked per round (see selectNewSong below);
// exposed through a getter so callers holding a reference to the `songs`
// module always see the current pick, not the one at require() time.
let currentSong = pickRandomSong();

function selectNewSong() {
  currentSong = pickRandomSong();
  return currentSong;
}

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .trim();
}

function getPlayableTitles() {
  return songs.map((song) => ({ title: song.title, artist: song.artist }));
}

function findSongByTitle(title) {
  const target = normalize(title);
  return songs.find((song) => normalize(song.title) === target) || null;
}

function getTodaysAudioPath() {
  return path.join(AUDIO_DIR, currentSong.audioFile);
}

module.exports = {
  get randomSong() {
    return currentSong;
  },
  selectNewSong,
  normalize,
  getPlayableTitles,
  findSongByTitle,
  getTodaysAudioPath,
};
