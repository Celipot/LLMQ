// In-memory game state machine, keyed per round (see server/index.js for how
// keys are built: 'random:<songId>' vs 'list:<songId>', kept in separate
// namespaces so a Random-mode pick never leaks into the List-mode badges for
// the same song). Isolated from song data and from Express so a future
// per-player store can wrap this same shape.

const TIERS_SECONDS = [1, 2, 4, 7, 11, 16];
const MAX_ATTEMPTS = TIERS_SECONDS.length;

const states = new Map();

function createInitialState() {
  return {
    attemptsUsed: 0,
    status: 'playing', // 'playing' | 'won' | 'lost'
    guesses: [], // { type: 'guess' | 'skip', title: string | null, correct: boolean | null }
  };
}

function getOrCreate(key) {
  if (!states.has(key)) {
    states.set(key, createInitialState());
  }
  return states.get(key);
}

function resetState(key) {
  states.set(key, createInitialState());
  return getPublicState(key);
}

function currentAllowedSeconds(key) {
  const state = getOrCreate(key);
  const tierIndex = Math.min(state.attemptsUsed, MAX_ATTEMPTS - 1);
  return TIERS_SECONDS[tierIndex];
}

function isFinished(key) {
  const state = states.get(key);
  return state ? state.status !== 'playing' : false;
}

// 'not_started' when the round has never been touched, so list badges don't
// need to distinguish "no entry yet" from "entry read without mutating".
function getStatus(key) {
  const state = states.get(key);
  return state ? state.status : 'not_started';
}

// correctSong is passed in by the caller (server knows it via songs.js) so
// this module never has to import song data itself.
function getPublicState(key, correctSong) {
  const state = getOrCreate(key);
  const publicState = {
    attemptsUsed: state.attemptsUsed,
    maxAttempts: MAX_ATTEMPTS,
    allowedSeconds: currentAllowedSeconds(key),
    status: state.status,
    guesses: state.guesses,
  };
  if (isFinished(key) && correctSong) {
    publicState.correctTitle = correctSong.title;
    publicState.correctArtist = correctSong.artist;
    publicState.correctCoverUrl = correctSong.coverUrl;
  }
  return publicState;
}

function applyGuess(key, title, isCorrect) {
  const state = getOrCreate(key);
  if (isFinished(key)) {
    throw new Error('GAME_FINISHED');
  }
  state.attemptsUsed += 1;
  state.guesses.push({ type: 'guess', title, correct: isCorrect });
  if (isCorrect) {
    state.status = 'won';
  } else if (state.attemptsUsed >= MAX_ATTEMPTS) {
    state.status = 'lost';
  }
  return isCorrect;
}

function applySkip(key) {
  const state = getOrCreate(key);
  if (isFinished(key)) {
    throw new Error('GAME_FINISHED');
  }
  state.attemptsUsed += 1;
  state.guesses.push({ type: 'skip', title: null, correct: null });
  if (state.attemptsUsed >= MAX_ATTEMPTS) {
    state.status = 'lost';
  }
}

module.exports = {
  TIERS_SECONDS,
  MAX_ATTEMPTS,
  resetState,
  currentAllowedSeconds,
  isFinished,
  getStatus,
  getPublicState,
  applyGuess,
  applySkip,
};
