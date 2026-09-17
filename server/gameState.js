// In-memory single-game state machine for the MVP.
// No multiplayer/session concept yet, but kept isolated from the song data
// and from Express so a future per-player store can wrap this same shape.

const TIERS_SECONDS = [1, 2, 4, 7, 11, 16];
const MAX_ATTEMPTS = TIERS_SECONDS.length;

function createInitialState() {
  return {
    attemptsUsed: 0,
    status: 'playing', // 'playing' | 'won' | 'lost'
    guesses: [], // { type: 'guess' | 'skip', title: string | null, correct: boolean | null }
  };
}

let state = createInitialState();

function reset() {
  state = createInitialState();
  return getPublicState();
}

function currentAllowedSeconds() {
  const tierIndex = Math.min(state.attemptsUsed, MAX_ATTEMPTS - 1);
  return TIERS_SECONDS[tierIndex];
}

function isFinished() {
  return state.status !== 'playing';
}

// correctSong is passed in by the caller (server knows it via songs.json)
// so this module never has to import song data itself.
function getPublicState(correctSong) {
  const publicState = {
    attemptsUsed: state.attemptsUsed,
    maxAttempts: MAX_ATTEMPTS,
    allowedSeconds: currentAllowedSeconds(),
    status: state.status,
    guesses: state.guesses,
  };
  if (isFinished() && correctSong) {
    publicState.correctTitle = correctSong.title;
    publicState.correctArtist = correctSong.artist;
    publicState.correctCoverUrl = correctSong.coverUrl;
  }
  return publicState;
}

function applyGuess(title, isCorrect) {
  if (isFinished()) {
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

function applySkip() {
  if (isFinished()) {
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
  reset,
  currentAllowedSeconds,
  isFinished,
  getPublicState,
  applyGuess,
  applySkip,
};
