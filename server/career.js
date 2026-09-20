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
// after the second. A third phase of 30 turns follows, ended by the finale.
const RELEASE_AFTER_TURN = 10;
const CONCERT_AFTER_TURN = 2 * RELEASE_AFTER_TURN;
const FINAL_TURN = CONCERT_AFTER_TURN + 30;
const MAX_ENERGY = 4;
const STUDY_COST = 1;
const SINGLE_COST = 2;

// Finding the title earlier teaches more; failing still teaches a little.
const STUDY_GAINS = { byStage: { 1: 40, 2: 30, 3: 25 }, late: 20, failed: 15 };
const SINGLE_GAINS = { byStage: { 1: 90, 2: 65, 3: 50 }, late: 45, failed: 30 };

// Fans (FSI, "fan de school idols") are only won by releasing music: singles
// and the album. A minimum is required to take part in the concert.
const FANS_REQUIRED = 750;
const SINGLE_FANS = { byStage: { 1: 40, 2: 30, 3: 25 }, late: 20, failed: 10 };
const ALBUM_FANS_DIVISOR = 2;
// The album must be graded at least this well, otherwise the career is failed.
const ALBUM_GOAL_GRADE = 'B';
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'];

const ALBUM_SIZE = 6;
const CONCERT_SIZE = 15;
const FINALE_SIZE = 50;
const TRACK_POINTS_BY_STAGE = { 1: 100, 2: 70, 3: 50, 4: 35, 5: 25 };
const MAX_ALBUM_SCORE = ALBUM_SIZE * TRACK_POINTS_BY_STAGE[1];
const MAX_CONCERT_SCORE = CONCERT_SIZE * TRACK_POINTS_BY_STAGE[1];
const MAX_FINALE_SCORE = FINALE_SIZE * TRACK_POINTS_BY_STAGE[1];

// In the third phase albums and concerts are released on demand and cost
// energy, paid with the first track. The finale is free and only due at the end.
const LIVES = {
  album: { size: ALBUM_SIZE, cost: 3, maxScore: MAX_ALBUM_SCORE },
  concert: { size: CONCERT_SIZE, cost: 4, maxScore: MAX_CONCERT_SCORE },
  finale: { size: FINALE_SIZE, cost: 0, maxScore: MAX_FINALE_SCORE },
};
// To take part in the finale: this many sorties in the third phase, of which
// this many graded at least ALBUM_GOAL_GRADE ("above the average").
const FINALE_GOALS = {
  concerts: { required: 2, requiredGood: 2 },
  albums: { required: 3, requiredGood: 2 },
};

// The maximum of a stat is its last bonus step; it can keep growing past it.
const STAT_MAX = {
  oreille: BASE_TIERS.length * STAT_STEP,
  memoire: MAX_EXTRA_SUGGESTIONS * STAT_STEP,
  culture: MAX_EXTRA_TIERS * STAT_STEP,
};
// A temporary penalty can push a stat under 0 (which removes a feature) but no further.
const MIN_EFFECTIVE_STAT = -100;
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

// A negative stat removes a feature below the starting level: one tier only for
// culture, a shorter first tier for hearing. bonusSeconds lengthens every tier.
function roundTiers(stats, bonusSeconds = 0) {
  const tiers = stats.culture < 0 ? [BASE_TIERS[0]] : [...BASE_TIERS];
  if (stats.oreille < 0) tiers[0] -= HEARING_BONUS_SECONDS;
  const hearingSteps = Math.min(unlockedSteps(stats.oreille), tiers.length);
  for (let i = 0; i < hearingSteps; i += 1) tiers[i] += HEARING_BONUS_SECONDS;
  const extraTiers = Math.min(unlockedSteps(stats.culture), MAX_EXTRA_TIERS);
  for (let i = 0; i < extraTiers; i += 1) tiers.push(tiers.length + 1);
  return tiers.map((seconds) => seconds + bonusSeconds);
}

function suggestionCount(stats) {
  if (stats.memoire < 0) return 0;
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
    sorties: [],
    live: null,
    modifiers: [],
    pendingChoice: null,
    eventTurns: {},
    firedEvents: [],
    events: [],
    streak: [],
    fans: 0,
    failure: null,
  };
}

// The track being played in a sortie, 1-based: the round in progress is not recorded yet.
function liveTrackNumber(state) {
  return state.live.tracks.length + 1;
}

// The base stats plus the temporary penalties still running: those of the turns,
// and those of the tracks of a finale.
function effectiveStats(state) {
  const stats = { ...state.stats };
  state.modifiers.forEach(({ stat, delta, expiresAtTurn }) => {
    if (state.turn < expiresAtTurn) stats[stat] += delta;
  });
  if (state.live) {
    state.live.penalties.forEach(({ stat, delta, untilTrack }) => {
      if (liveTrackNumber(state) <= untilTrack) stats[stat] += delta;
    });
  }
  STATS.forEach((stat) => {
    stats[stat] = Math.max(MIN_EFFECTIVE_STAT, stats[stat]);
  });
  return stats;
}

// state.release is the released album, state.concert the finished concert.
function isReleaseDue(state) {
  return !state.release && state.turn > RELEASE_AFTER_TURN;
}

// Extra seconds on every tier granted by a finale event, while it lasts.
function roundBonusSeconds(state) {
  const bonus = state.live?.bonus;
  return bonus && liveTrackNumber(state) <= bonus.untilTrack ? bonus.seconds : 0;
}

function isConcertDue(state) {
  return Boolean(state.release) && !state.failure && !state.concert && state.turn > CONCERT_AFTER_TURN;
}

// state.concert is the concert of the second phase: it opens the third one.
function isPhase3(state) {
  return Boolean(state.concert);
}

// state.finale is the finished finale, which ends the career.
function isFinaleDue(state) {
  return isPhase3(state) && !state.failure && !state.finale && state.turn > FINAL_TURN;
}

function finaleGoals(state) {
  const goals = {};
  Object.entries({ concerts: 'concert', albums: 'album' }).forEach(([name, kind]) => {
    const sorties = state.sorties.filter((sortie) => sortie.kind === kind);
    goals[name] = {
      done: sorties.length,
      good: sorties.filter((sortie) => albumGoalReached(sortie.grade)).length,
      ...FINALE_GOALS[name],
    };
  });
  goals.met = Object.keys(FINALE_GOALS).every(
    (name) => goals[name].done >= goals[name].required && goals[name].good >= goals[name].requiredGood,
  );
  return goals;
}

// Spending a turn ends the second phase on a failure when the fans needed for
// the concert were not won in time, and the third one when the goals of the
// finale were not reached.
function advanceTurn(state) {
  state.turn += 1;
  if (state.release && !state.concert && state.turn > CONCERT_AFTER_TURN && state.fans < FANS_REQUIRED) {
    state.failure = 'FANS';
  }
  if (isPhase3(state) && state.turn > FINAL_TURN && !finaleGoals(state).met) state.failure = 'FINALE_GOALS';
}

function isOver(state) {
  return Boolean(state.failure || state.finale);
}

// What was played counts, so a career failed early still gets a (low) score.
function careerScore(state) {
  const album = state.release?.score ?? 0;
  const concert = state.concert?.score ?? 0;
  const sorties = state.sorties.reduce((total, sortie) => total + sortie.score, 0);
  const finale = state.finale?.score ?? 0;
  const stats = Object.values(state.stats).reduce((total, value) => total + value, 0);
  const total = album + concert + sorties + finale + stats + state.fans;
  return { album, concert, sorties, finale, stats, fans: state.fans, total };
}

function assertIdle(state) {
  if (isOver(state)) throw new Error('CAREER_FINISHED');
  if (state.pendingChoice) throw new Error('EVENT_PENDING');
}

function assertTurnAvailable(state) {
  assertIdle(state);
  if (state.live) throw new Error('RELEASE_IN_PROGRESS');
  if (isReleaseDue(state)) throw new Error('RELEASE_DUE');
  if (isConcertDue(state)) throw new Error('CONCERT_DUE');
  if (isFinaleDue(state)) throw new Error('FINALE_DUE');
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
  assertIdle(state);
  if (!isReleaseDue(state)) throw new Error('RELEASE_NOT_DUE');
}

function assertCanConcert(state) {
  assertIdle(state);
  if (!isConcertDue(state)) throw new Error('CONCERT_NOT_DUE');
}

function recordTrack(tracks, foundAtStage, songId) {
  tracks.push({ songId, rank: releaseRank(foundAtStage), points: trackPoints(foundAtStage) });
}

// turn is the one the release is dated with, shown in the career history.
function summarize(tracks, maxScore, turn) {
  const score = tracks.reduce((total, track) => total + track.points, 0);
  return { score, grade: grade(score, maxScore), turn, tracks };
}

// The album is released once its last track is recorded; the career goes on
// with a second phase of turns.
function finishAlbumTrack(state, foundAtStage, songId) {
  assertCanRelease(state);
  recordTrack(state.album, foundAtStage, songId);
  if (state.album.length < ALBUM_SIZE) return;
  state.release = summarize(state.album, MAX_ALBUM_SCORE, RELEASE_AFTER_TURN);
  state.fans += Math.floor(state.release.score / ALBUM_FANS_DIVISOR);
  if (!albumGoalReached(state.release.grade)) state.failure = 'ALBUM_GRADE';
}

// The concert of the second phase opens the third one once its last track is
// recorded.
function finishConcertTrack(state, foundAtStage, songId) {
  assertCanConcert(state);
  recordTrack(state.concertTracks, foundAtStage, songId);
  if (state.concertTracks.length === CONCERT_SIZE) {
    state.concert = summarize(state.concertTracks, MAX_CONCERT_SCORE, CONCERT_AFTER_TURN);
  }
}

// Starts (or goes on with) a sortie of the third phase or the finale. The
// energy is paid once, with the first track, so a refusal draws no title.
function startLive(state, kind) {
  assertIdle(state);
  if (state.live) {
    if (state.live.kind !== kind) throw new Error('RELEASE_IN_PROGRESS');
    return;
  }
  if (kind === 'finale') {
    if (!isFinaleDue(state)) throw new Error('FINALE_NOT_DUE');
  } else {
    if (isFinaleDue(state)) throw new Error('FINALE_DUE');
    if (!isPhase3(state)) throw new Error(kind === 'album' ? 'RELEASE_NOT_DUE' : 'CONCERT_NOT_DUE');
    if (state.energy < LIVES[kind].cost) throw new Error('NO_ENERGY');
    state.energy -= LIVES[kind].cost;
  }
  state.live = { kind, tracks: [], penalties: [], bonus: null };
}

// The last track releases the sortie. An album and a concert use a turn, an
// album also wins fans; the finale ends the career.
function finishLiveTrack(state, foundAtStage, songId) {
  const { kind, tracks } = state.live;
  const { size, maxScore } = LIVES[kind];
  recordTrack(tracks, foundAtStage, songId);
  if (tracks.length < size) return;
  const result = summarize(tracks, maxScore, kind === 'finale' ? FINAL_TURN : state.turn);
  state.live = null;
  if (kind === 'finale') {
    state.finale = result;
    return;
  }
  state.sorties.push({ kind, ...result });
  if (kind === 'album') state.fans += Math.floor(result.score / ALBUM_FANS_DIVISOR);
  advanceTurn(state);
}

function liveSongIds(state) {
  return state.live ? state.live.tracks.map((track) => track.songId) : [];
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
  CONCERT_AFTER_TURN,
  FINAL_TURN,
  MAX_ENERGY,
  STAT_MAX,
  ALBUM_SIZE,
  CONCERT_SIZE,
  FINALE_SIZE,
  MAX_ALBUM_SCORE,
  MAX_CONCERT_SCORE,
  MAX_FINALE_SCORE,
  LIVES,
  discographyIds,
  roundTiers,
  suggestionCount,
  studyGain,
  singleGain,
  singleFans,
  createCareer,
  effectiveStats,
  roundBonusSeconds,
  liveTrackNumber,
  isReleaseDue,
  isConcertDue,
  isPhase3,
  isFinaleDue,
  finaleGoals,
  isOver,
  careerScore,
  assertCanStudy,
  assertCanSingle,
  study,
  single,
  rest,
  assertCanRelease,
  assertCanConcert,
  finishAlbumTrack,
  finishConcertTrack,
  startLive,
  finishLiveTrack,
  liveSongIds,
  trackPoints,
  grade,
  releaseRank,
  pickStat,
  pickSongId,
  pickPreparedSongId,
};
