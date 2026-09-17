// Loads the playable song library from data/songs.json.
// MVP has a single fixed song, but everything here is shaped for a list
// so multi-song support later doesn't require touching the API surface.
const fs = require('fs');
const path = require('path');

const SONGS_PATH = path.join(__dirname, '..', 'data', 'songs.json');
const AUDIO_DIR = path.join(__dirname, '..', 'data', 'audio');

const songs = JSON.parse(fs.readFileSync(SONGS_PATH, 'utf8'));

// The one song the daily puzzle is currently built around.
const todaysSong = songs[0];

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .trim();
}

function getPlayableTitles() {
  return songs.map((song) => song.title);
}

function findSongByTitle(title) {
  const target = normalize(title);
  return songs.find((song) => normalize(song.title) === target) || null;
}

function getTodaysAudioPath() {
  return path.join(AUDIO_DIR, todaysSong.audioFile);
}

module.exports = {
  todaysSong,
  normalize,
  getPlayableTitles,
  findSongByTitle,
  getTodaysAudioPath,
};
