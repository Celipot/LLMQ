// Glue between a player's solo session, the round state machine and the career
// rules. A career round is played through the regular /api/guess, /api/skip and
// /audio/track routes: starting one points the session's active round at it,
// and settleRound applies its outcome to the career once it is finished.

const gameState = require('./gameState');
const songs = require('./songs');
const career = require('./career');

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

function createCareer(session) {
  session.career = career.createCareer();
  session.careerRound = null;
}

function publicCareer(session) {
  const state = session.career;
  return {
    turn: state.turn,
    totalTurns: career.TOTAL_TURNS,
    energy: state.energy,
    maxEnergy: career.MAX_ENERGY,
    stats: { ...state.stats },
    suggestionCount: career.suggestionCount(state.stats),
    notebook: state.notebook.map(songSummary),
    releaseDue: career.isReleaseDue(state),
    album: { done: state.album.length, total: career.ALBUM_SIZE },
    release: state.release
      ? {
          score: state.release.score,
          maxScore: career.MAX_ALBUM_SCORE,
          grade: state.release.grade,
          tracks: state.release.tracks.map(({ songId, rank, points }) => ({
            song: songSummary(songId),
            rank,
            points,
          })),
        }
      : null,
  };
}

// The title is only revealed by getPublicState once the round is finished.
function publicRound(session) {
  const round = session.careerRound;
  if (!round) return null;
  const { id, title, artist, coverUrl } = songs.getSongById(round.songId);
  return {
    kind: round.kind,
    stat: round.stat,
    state: gameState.getPublicState(round.key, { id, title, artist, coverUrl }),
  };
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
  gameState.resetState(key, career.roundTiers(session.career.stats));
  session.careerRound = { kind, stat, songId, key };
  resumeRound(session);
}

function rest(session) {
  career.rest(session.career);
}

function startStudy(session, stat) {
  career.assertCanStudy(session.career, stat);
  startRound(session, 'study', stat, career.pickSongId(discography, session.career.notebook));
}

// Starts the next track of the album: it goes on until the 6th one is played.
function startRelease(session) {
  const { notebook, album } = session.career;
  career.assertCanRelease(session.career);
  const albumSongIds = album.map((track) => track.songId);
  startRound(session, 'release', null, career.pickAlbumSongId(discography, notebook, albumSongIds));
}

// Returns true when a finished round was applied to the career.
function settleRound(session) {
  const round = session.careerRound;
  if (!round || !gameState.isFinished(round.key)) return false;
  const { status, attemptsUsed } = gameState.getPublicState(round.key);
  const foundAtStage = status === 'won' ? attemptsUsed : null;
  if (round.kind === 'study') {
    career.study(session.career, round.stat, foundAtStage, round.songId);
  } else {
    career.finishAlbumTrack(session.career, foundAtStage, round.songId);
  }
  session.careerRound = null;
  return true;
}

module.exports = {
  createCareer,
  publicCareer,
  publicRound,
  resumeRound,
  rest,
  startStudy,
  startRelease,
  settleRound,
};
