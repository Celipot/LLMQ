// Pure rules of the Mode Carrière (see us/carriere-v1.md and us/carriere-v2.md):
// stats, energy, turns and ranks. Isolated from Express and from song data, like gameState.js.

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

// Two phases of 10 turns: the album is released after the first, the concert
// after the second.
const RELEASE_AFTER_TURN = 10;
const TOTAL_TURNS = 2 * RELEASE_AFTER_TURN;
const MAX_ENERGY = 4;
const STUDY_COST = 1;
const SINGLE_COST = 2;

// Finding the title earlier teaches more; failing still teaches a little.
const STUDY_GAINS = { byStage: { 1: 40, 2: 30, 3: 25 }, late: 20, failed: 15 };
const SINGLE_GAINS = { byStage: { 1: 90, 2: 65, 3: 50 }, late: 45, failed: 30 };

// Fans (FSI, "fan de school idols") are only won by releasing music: singles
// and the album. A minimum is required to take part in the concert.
const FANS_REQUIRED = 300;
const SINGLE_FANS = { byStage: { 1: 40, 2: 30, 3: 25 }, late: 20, failed: 10 };
const ALBUM_FANS_DIVISOR = 2;
// The album must be graded at least this well, otherwise the career is failed.
const ALBUM_GOAL_GRADE = 'B';
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'];

const ALBUM_SIZE = 6;
const CONCERT_SIZE = 15;
const TRACK_POINTS_BY_STAGE = { 1: 100, 2: 70, 3: 50, 4: 35, 5: 25 };
const MAX_ALBUM_SCORE = ALBUM_SIZE * TRACK_POINTS_BY_STAGE[1];
const MAX_CONCERT_SCORE = CONCERT_SIZE * TRACK_POINTS_BY_STAGE[1];
// Minimum share of the maximum score (in %) for each grade, best first.
const GRADES = [
  ['S', 90],
  ['A', 70],
  ['B', 50],
  ['C', 30],
];

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

function gainFor(gains, foundAtStage) {
  if (foundAtStage === null) return gains.failed;
  return gains.byStage[foundAtStage] ?? gains.late;
}

function studyGain(foundAtStage) {
  return gainFor(STUDY_GAINS, foundAtStage);
}

function singleGain(foundAtStage) {
  return gainFor(SINGLE_GAINS, foundAtStage);
}

function singleFans(foundAtStage) {
  return gainFor(SINGLE_FANS, foundAtStage);
}

function albumGoalReached(grade) {
  return GRADE_ORDER.indexOf(grade) <= GRADE_ORDER.indexOf(ALBUM_GOAL_GRADE);
}

function createCareer() {
  return {
    turn: 1,
    energy: MAX_ENERGY,
    stats: { oreille: 0, memoire: 0, culture: 0 },
    notebook: [],
    album: [],
    concertTracks: [],
    fans: 0,
    failure: null,
  };
}

// state.release is the released album, state.concert the finished concert.
function isReleaseDue(state) {
  return !state.release && state.turn > RELEASE_AFTER_TURN;
}

function isConcertDue(state) {
  return Boolean(state.release) && !state.failure && !state.concert && state.turn > TOTAL_TURNS;
}

// Spending a turn ends the second phase on a failure when the fans needed for
// the concert were not won in time.
function advanceTurn(state) {
  state.turn += 1;
  if (state.release && state.turn > TOTAL_TURNS && state.fans < FANS_REQUIRED) state.failure = 'FANS';
}

function assertTurnAvailable(state) {
  if (state.concert || state.failure) throw new Error('CAREER_FINISHED');
  if (isReleaseDue(state)) throw new Error('RELEASE_DUE');
  if (isConcertDue(state)) throw new Error('CONCERT_DUE');
}

// Checked before a round starts, so a refused action never draws a title.
function assertCanSpend(state, stat, cost) {
  assertTurnAvailable(state);
  if (!STATS.includes(stat)) throw new Error('INVALID_STAT');
  if (state.energy < cost) throw new Error('NO_ENERGY');
}

function assertCanStudy(state, stat) {
  assertCanSpend(state, stat, STUDY_COST);
}

function assertCanSingle(state, stat) {
  assertCanSpend(state, stat, SINGLE_COST);
}

// foundAtStage is the 1-based tier the title was found at, null when the study
// round was lost. Nothing is mutated unless every check passes.
function study(state, stat, foundAtStage, songId) {
  assertCanStudy(state, stat);
  state.energy -= STUDY_COST;
  state.stats[stat] += studyGain(foundAtStage);
  if (foundAtStage !== null) state.notebook.push(songId);
  advanceTurn(state);
}

// A single trains harder than a study but its title never enters the notebook.
function single(state, stat, foundAtStage) {
  assertCanSingle(state, stat);
  state.energy -= SINGLE_COST;
  state.stats[stat] += singleGain(foundAtStage);
  state.fans += singleFans(foundAtStage);
  advanceTurn(state);
}

function rest(state) {
  assertTurnAvailable(state);
  state.energy = MAX_ENERGY;
  advanceTurn(state);
}

function releaseRank(foundAtStage) {
  if (foundAtStage === null) return 'FAIL';
  if (foundAtStage === 1) return 'S';
  if (foundAtStage === 2) return 'A';
  if (foundAtStage === 3) return 'B';
  return 'C';
}

function trackPoints(foundAtStage) {
  return TRACK_POINTS_BY_STAGE[foundAtStage] ?? 0;
}

// Integer comparison: a share like 70% of 600 must not depend on float rounding.
function grade(score, maxScore) {
  const found = GRADES.find(([, percent]) => score * 100 >= percent * maxScore);
  return found ? found[0] : 'D';
}

function assertCanRelease(state) {
  if (state.concert || state.failure) throw new Error('CAREER_FINISHED');
  if (!isReleaseDue(state)) throw new Error('RELEASE_NOT_DUE');
}

function assertCanConcert(state) {
  if (state.concert || state.failure) throw new Error('CAREER_FINISHED');
  if (!isConcertDue(state)) throw new Error('CONCERT_NOT_DUE');
}

function recordTrack(tracks, foundAtStage, songId) {
  tracks.push({ songId, rank: releaseRank(foundAtStage), points: trackPoints(foundAtStage) });
}

function summarize(tracks, maxScore) {
  const score = tracks.reduce((total, track) => total + track.points, 0);
  return { score, grade: grade(score, maxScore), tracks };
}

// The album is released once its last track is recorded; the career goes on
// with a second phase of turns.
function finishAlbumTrack(state, foundAtStage, songId) {
  assertCanRelease(state);
  recordTrack(state.album, foundAtStage, songId);
  if (state.album.length < ALBUM_SIZE) return;
  state.release = summarize(state.album, MAX_ALBUM_SCORE);
  state.fans += Math.floor(state.release.score / ALBUM_FANS_DIVISOR);
  if (!albumGoalReached(state.release.grade)) state.failure = 'ALBUM_GRADE';
}

// The concert ends the career once its last track is recorded.
function finishConcertTrack(state, foundAtStage, songId) {
  assertCanConcert(state);
  recordTrack(state.concertTracks, foundAtStage, songId);
  if (state.concertTracks.length === CONCERT_SIZE) {
    state.concert = summarize(state.concertTracks, MAX_CONCERT_SCORE);
  }
}

// A single trains a stat the player does not choose.
function pickStat(random = Math.random) {
  return STATS[Math.floor(random() * STATS.length)];
}

// Prefers a title the player has not found yet; once the whole pool is found
// it draws again from the full pool rather than failing.
function pickSongId(pool, foundIds, random = Math.random) {
  const candidates = pool.filter((id) => !foundIds.includes(id));
  const source = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(random() * source.length)];
}

// The album and the concert are drawn from the titles found while studying;
// when there are not enough (or none), they are completed with random titles
// of the pool. A title never appears twice on the same album or concert.
function pickPreparedSongId(pool, studiedIds, usedIds, random = Math.random) {
  const unused = pool.filter((id) => !usedIds.includes(id));
  const studied = unused.filter((id) => studiedIds.includes(id));
  const source = studied.length > 0 ? studied : unused;
  return source[Math.floor(random() * source.length)];
}

module.exports = {
  FANS_REQUIRED,
  ALBUM_GOAL_GRADE,
  RELEASE_AFTER_TURN,
  TOTAL_TURNS,
  MAX_ENERGY,
  ALBUM_SIZE,
  CONCERT_SIZE,
  MAX_ALBUM_SCORE,
  MAX_CONCERT_SCORE,
  discographyIds,
  roundTiers,
  suggestionCount,
  studyGain,
  singleGain,
  singleFans,
  createCareer,
  isReleaseDue,
  isConcertDue,
  assertCanStudy,
  assertCanSingle,
  study,
  single,
  rest,
  assertCanRelease,
  assertCanConcert,
  finishAlbumTrack,
  finishConcertTrack,
  trackPoints,
  grade,
  releaseRank,
  pickStat,
  pickSongId,
  pickPreparedSongId,
};
