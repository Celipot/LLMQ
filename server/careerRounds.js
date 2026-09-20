// Glue between a player's solo session, the round state machine and the career
// rules. A career round is played through the regular /api/guess, /api/skip and
// /audio/track routes: starting one points the session's active round at it,
// and settleRound applies its outcome to the career once it is finished.

const gameState = require('./gameState');
const songs = require('./songs');
const career = require('./career');
const careerEvents = require('./careerEvents');

const discography = career.discographyIds(songs.getPlayableTitles());

function songSummary(id) {
  const { title, coverUrl } = songs.getSongById(id);
  return { id, title, coverUrl };
}

// Namespaced apart from the 'random' and 'list' keys, so a career title never
// shows up as "en cours" in the Bibliothèque (that would reveal the answer).
function roundKey(session, songId) {
  return `${session.id}:career:${songId}`;
}

function createCareer(session, difficulty) {
  session.career = career.createCareer(difficulty);
  careerEvents.scheduleEvents(session.career);
  session.careerRound = null;
  session.careerNewEvents = [];
}

function abandonCareer(session) {
  session.career = null;
  session.careerRound = null;
  session.careerNewEvents = [];
}

function publicTracks(tracks) {
  return tracks.map(({ songId, rank, points }) => ({ song: songSummary(songId), rank, points }));
}

function publicResult(result, maxScore) {
  if (!result) return null;
  return {
    score: result.score,
    maxScore,
    grade: result.grade,
    turn: result.turn,
    tracks: publicTracks(result.tracks),
  };
}

function publicSortie(sortie) {
  return { kind: sortie.kind, ...publicResult(sortie, career.LIVES[sortie.kind].maxScore) };
}

function publicLive(state) {
  if (!state.live) return null;
  return { kind: state.live.kind, done: state.live.tracks.length, total: career.LIVES[state.live.kind].size };
}

// The titles won by an event are told to the player, not only their number.
function publicEvent(event) {
  return event.gained ? { ...event, gained: event.gained.map(songSummary) } : event;
}

function publicCareer(session) {
  const state = session.career;
  const stats = career.effectiveStats(state);
  const settings = career.settingsOf(state);
  return {
    difficulty: state.difficulty,
    baseTiers: settings.baseTiers,
    baseSuggestions: settings.baseSuggestions,
    turn: state.turn,
    concertAt: career.CONCERT_AFTER_TURN,
    finalTurn: career.FINAL_TURN,
    releaseAt: career.RELEASE_AFTER_TURN,
    energy: state.energy,
    maxEnergy: career.MAX_ENERGY,
    stats,
    statMax: career.STAT_MAX,
    modifiers: state.modifiers.filter(({ expiresAtTurn }) => state.turn < expiresAtTurn),
    suggestionCount: career.suggestionCount(stats, settings),
    costs: { study: career.STUDY_COST, single: career.SINGLE_COST },
    statStep: career.STAT_STEP,
    notebook: state.notebook.map(songSummary),
    releaseDue: career.isReleaseDue(state),
    album: { done: state.album.length, total: career.ALBUM_SIZE },
    release: publicResult(state.release, career.MAX_ALBUM_SCORE),
    finalScore: career.isOver(state) ? career.careerScore(state) : null,
    fans: { current: state.fans, required: settings.fansRequired },
    failure: state.failure,
    albumGoalGrade: settings.albumGoalGrade,
    concertDue: career.isConcertDue(state),
    concert: { done: state.concertTracks.length, total: career.CONCERT_SIZE },
    concertResult: publicResult(state.concert, career.MAX_CONCERT_SCORE),
    phase3: career.isPhase3(state),
    sorties: state.sorties.map(publicSortie),
    liveCosts: { album: career.LIVES.album.cost, concert: career.LIVES.concert.cost },
    live: publicLive(state),
    finaleGoals: career.finaleGoals(state),
    finaleDue: career.isFinaleDue(state),
    finaleResult: publicResult(state.finale, career.MAX_FINALE_SCORE),
    events: state.events,
    newEvents: session.careerNewEvents.map(publicEvent),
    pendingChoice: state.pendingChoice,
  };
}

// The title is only revealed by getPublicState once the round is finished.
function publicRound(session) {
  const round = session.careerRound;
  if (!round) return null;
  const { id, title, artist, coverUrl } = songs.getSongById(round.songId);
  const result = {
    kind: round.kind,
    stat: round.stat,
    inNotebook: session.career.notebook.includes(round.songId),
    state: gameState.getPublicState(round.key, { id, title, artist, coverUrl }),
  };
  if (career.settingsOf(session.career).hint) result.hint = career.artistHint(artist);
  return result;
}

// The player may have gone to another solo mode meanwhile, which moved the
// session's active round elsewhere.
function resumeRound(session) {
  const round = session.careerRound;
  if (!round) return;
  session.activeSongId = round.songId;
  session.activeKey = round.key;
}

function startRound(session, kind, stat, songId) {
  const key = roundKey(session, songId);
  const { career: state } = session;
  gameState.resetState(
    key,
    career.roundTiers(career.effectiveStats(state), career.roundBonusSeconds(state), career.settingsOf(state)),
  );
  session.careerRound = { kind, stat, songId, key };
  resumeRound(session);
}

// Events are applied once an action is over and returned with its response.
function applyEvents(session) {
  const fired = careerEvents.applyDueEvents(session.career, { pool: discography, random: Math.random });
  session.careerNewEvents.push(...fired);
}

function rest(session) {
  career.rest(session.career);
  session.careerNewEvents = [];
  applyEvents(session);
}

function startStudy(session, stat) {
  career.assertCanStudy(session.career, stat);
  session.careerNewEvents = [];
  startRound(session, 'study', stat, career.pickSongId(discography, session.career.notebook));
}

// A single trains harder than a study, on a random stat, and its title is not
// added to the notebook.
function startSingle(session) {
  const stat = career.pickStat();
  career.assertCanSingle(session.career, stat);
  session.careerNewEvents = [];
  startRound(session, 'single', stat, career.pickSongId(discography, session.career.notebook));
}

function trackSongIds(tracks) {
  return tracks.map((track) => track.songId);
}

// The finale events are drawn with its first track and fire before the track they
// are scheduled on starts, so that their effect applies to it.
function startFinaleTrack(session) {
  const { live } = session.career;
  if (!live.schedule) careerEvents.scheduleFinaleEvents(live);
  session.careerNewEvents.push(...careerEvents.applyFinaleEvents(session.career, { random: Math.random }));
}

// A sortie of the third phase or the finale: the tracks go on until the last.
function startLive(session, kind, roundKind) {
  const { notebook } = session.career;
  career.startLive(session.career, kind);
  session.careerNewEvents = [];
  if (kind === 'finale') startFinaleTrack(session);
  const songId = career.pickPreparedSongId(discography, notebook, career.liveSongIds(session.career), career.LIVES[kind].size);
  startRound(session, roundKind, null, songId);
}

// Starts the next track of the album: it goes on until the 6th one is played.
function startRelease(session) {
  if (career.isPhase3(session.career)) return startLive(session, 'album', 'release');
  const { notebook, album } = session.career;
  career.assertCanRelease(session.career);
  session.careerNewEvents = [];
  const songId = career.pickPreparedSongId(discography, notebook, trackSongIds(album), career.ALBUM_SIZE);
  return startRound(session, 'release', null, songId);
}

// Starts the next track of the concert: it goes on until the 15th one is played.
function startConcert(session) {
  if (career.isPhase3(session.career)) return startLive(session, 'concert', 'concert');
  const { notebook, concertTracks } = session.career;
  career.assertCanConcert(session.career);
  session.careerNewEvents = [];
  const songId = career.pickPreparedSongId(discography, notebook, trackSongIds(concertTracks), career.CONCERT_SIZE);
  return startRound(session, 'concert', null, songId);
}

function startFinale(session) {
  startLive(session, 'finale', 'finale');
}

function chooseReward(session, option) {
  const fired = careerEvents.chooseReward(session.career, option);
  session.careerNewEvents = [fired];
  applyEvents(session);
}

// A round only counts for the career once a whole action is over: a study or a
// single, or the last track of a sortie. Events never fire in the middle of one.
function settleTrack(state, round, foundAtStage) {
  if (state.live) {
    career.finishLiveTrack(state, foundAtStage, round.songId);
    return state.live === null;
  }
  if (round.kind === 'release') {
    career.finishAlbumTrack(state, foundAtStage, round.songId);
    return Boolean(state.release);
  }
  career.finishConcertTrack(state, foundAtStage, round.songId);
  return Boolean(state.concert);
}

// Returns true when a finished round was applied to the career.
function settleRound(session) {
  const round = session.careerRound;
  if (!round || !gameState.isFinished(round.key)) return false;
  const { status, attemptsUsed } = gameState.getPublicState(round.key);
  const foundAtStage = status === 'won' ? attemptsUsed : null;
  const state = session.career;
  session.careerNewEvents = [];
  if (round.kind === 'study' || round.kind === 'single') {
    if (round.kind === 'study') career.study(state, round.stat, foundAtStage, round.songId);
    else career.single(state, round.stat, foundAtStage);
    careerEvents.recordAnswer(state, foundAtStage);
    applyEvents(session);
  } else if (settleTrack(state, round, foundAtStage)) {
    applyEvents(session);
  }
  session.careerRound = null;
  return true;
}

module.exports = {
  createCareer,
  abandonCareer,
  publicCareer,
  publicRound,
  resumeRound,
  rest,
  startStudy,
  startSingle,
  startRelease,
  startConcert,
  startFinale,
  chooseReward,
  settleRound,
};
