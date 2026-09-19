// Pure rules of the Mode Carrière (see us/carriere-v1.md): stats, energy,
// turns and ranks. Isolated from Express and from song data, like gameState.js.

const DISCOGRAPHY_ARTISTS = new Set([
  'Ayumu Uehara (CV: Aguri Onishi)',
  'A・ZU・NA',
  'Nijigasaki High School Idol Club',
]);

const STATS = ['oreille', 'memoire', 'culture'];
const STAT_STEP = 100;
// Each tier is the total clip length at that attempt, so a wrong guess or a
// skip always reveals more of the intro.
const BASE_TIERS = [1, 2, 3];
const HEARING_BONUS_SECONDS = 0.5;
const MAX_EXTRA_TIERS = 2;
const MAX_EXTRA_SUGGESTIONS = 3;

const TOTAL_TURNS = 10;
const MAX_ENERGY = 3;
const STUDY_COST = 1;
const REST_GAIN = 3;

// Finding the title earlier teaches more; failing still teaches a little.
const STUDY_GAIN_BY_STAGE = { 1: 80, 2: 60, 3: 45 };
const STUDY_GAIN_LATE = 40;
const STUDY_GAIN_FAILED = 30;

function discographyIds(songs) {
  return songs.filter((song) => DISCOGRAPHY_ARTISTS.has(song.artist)).map((song) => song.id);
}

function unlockedSteps(value) {
  return Math.floor(value / STAT_STEP);
}

function roundTiers(stats) {
  const tiers = [...BASE_TIERS];
  const hearingSteps = Math.min(unlockedSteps(stats.oreille), tiers.length);
  for (let i = 0; i < hearingSteps; i += 1) tiers[i] += HEARING_BONUS_SECONDS;
  const extraTiers = Math.min(unlockedSteps(stats.culture), MAX_EXTRA_TIERS);
  for (let i = 0; i < extraTiers; i += 1) tiers.push(tiers.length + 1);
  return tiers;
}

function suggestionCount(stats) {
  return 1 + Math.min(unlockedSteps(stats.memoire), MAX_EXTRA_SUGGESTIONS);
}

function studyGain(foundAtStage) {
  if (foundAtStage === null) return STUDY_GAIN_FAILED;
  return STUDY_GAIN_BY_STAGE[foundAtStage] ?? STUDY_GAIN_LATE;
}

function createCareer() {
  return {
    turn: 1,
    energy: MAX_ENERGY,
    stats: { oreille: 0, memoire: 0, culture: 0 },
    notebook: [],
  };
}

function isReleaseDue(state) {
  return state.turn > TOTAL_TURNS;
}

function assertTurnAvailable(state) {
  if (state.release) throw new Error('CAREER_FINISHED');
  if (isReleaseDue(state)) throw new Error('RELEASE_DUE');
}

// Checked before a study round starts, so a refused study never draws a title.
function assertCanStudy(state, stat) {
  assertTurnAvailable(state);
  if (!STATS.includes(stat)) throw new Error('INVALID_STAT');
  if (state.energy < STUDY_COST) throw new Error('NO_ENERGY');
}

// foundAtStage is the 1-based tier the title was found at, null when the study
// round was lost. Nothing is mutated unless every check passes.
function study(state, stat, foundAtStage, songId) {
  assertCanStudy(state, stat);
  state.energy -= STUDY_COST;
  state.stats[stat] += studyGain(foundAtStage);
  if (foundAtStage !== null) state.notebook.push(songId);
  state.turn += 1;
}

function rest(state) {
  assertTurnAvailable(state);
  state.energy = Math.min(MAX_ENERGY, state.energy + REST_GAIN);
  state.turn += 1;
}

function releaseRank(foundAtStage) {
  if (foundAtStage === null) return 'FAIL';
  if (foundAtStage === 1) return 'S';
  if (foundAtStage === 2) return 'A';
  if (foundAtStage === 3) return 'B';
  return 'C';
}

function assertCanRelease(state) {
  if (state.release) throw new Error('CAREER_FINISHED');
  if (!isReleaseDue(state)) throw new Error('RELEASE_NOT_DUE');
}

function finishRelease(state, foundAtStage, songId) {
  assertCanRelease(state);
  state.release = { rank: releaseRank(foundAtStage), songId };
  if (foundAtStage !== null) state.notebook.push(songId);
}

// Prefers a title the player has not found yet; once the whole pool is found
// it draws again from the full pool rather than failing.
function pickSongId(pool, foundIds, random = Math.random) {
  const candidates = pool.filter((id) => !foundIds.includes(id));
  const source = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(random() * source.length)];
}

module.exports = {
  TOTAL_TURNS,
  MAX_ENERGY,
  discographyIds,
  roundTiers,
  suggestionCount,
  studyGain,
  createCareer,
  isReleaseDue,
  assertCanStudy,
  study,
  rest,
  assertCanRelease,
  finishRelease,
  releaseRank,
  pickSongId,
};
