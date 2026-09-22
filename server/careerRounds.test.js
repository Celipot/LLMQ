const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Before the leaderboard is first used, so that no test writes the real one.
process.env.LEADERBOARD_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'llmq-rounds-')), 'leaderboard.json');

const career = require('./career');
const careerRounds = require('./careerRounds');
const leaderboard = require('./leaderboard');
const songs = require('./songs');

const discographyIds = career.discographyIds(songs.getPlayableTitles(), 'azuna');

// A career one turn away from its end with every goal of the finale reached, without
// playing the 36 sorties it takes: only the finale is exercised here.
function sessionAtFinale() {
  const state = career.createCareer();
  state.release = { score: 600, grade: 'S', turn: 10, tracks: [] };
  state.concert = { score: 1500, grade: 'S', turn: 20, tracks: [] };
  state.sorties = [
    { kind: 'concert', score: 800, grade: 'B', turn: 22, tracks: [] },
    { kind: 'concert', score: 800, grade: 'B', turn: 24, tracks: [] },
    { kind: 'album', score: 400, grade: 'B', turn: 26, tracks: [] },
    { kind: 'album', score: 400, grade: 'B', turn: 28, tracks: [] },
    { kind: 'album', score: 0, grade: 'D', turn: 30, tracks: [] },
  ];
  state.turn = 41;
  return { id: 'finale-session-0001', career: state, careerRound: null, careerNewEvents: [] };
}

function withRandomAtZero(fn) {
  const original = Math.random;
  Math.random = () => 0;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// The round of the previous track is over: record it and free the session.
function finishTrack(session) {
  career.finishLiveTrack(session.career, 1, discographyIds[session.career.live.tracks.length]);
  session.careerRound = null;
}

describe('the events of the finale', () => {
  test('the first track fires nothing, the events being scheduled from the 2nd track on', () => {
    const session = sessionAtFinale();
    withRandomAtZero(() => careerRounds.startFinale(session));

    assert.deepEqual(careerRounds.publicCareer(session).newEvents, []);
    assert.deepEqual(session.career.live.schedule, { 12: 2, 13: 2, 14: 2, 15: 2 });
  });

  test('the 2nd track starts with the three penalties and the bonus, told to the player', () => {
    const session = sessionAtFinale();
    withRandomAtZero(() => careerRounds.startFinale(session));
    finishTrack(session);
    withRandomAtZero(() => careerRounds.startFinale(session));

    const { newEvents } = careerRounds.publicCareer(session);
    assert.deepEqual(
      newEvents.map((event) => event.text),
      [
        'Chant −500 pendant 3 titres',
        'Connaissances −500 pendant 3 titres',
        'Endurance −500 pendant 3 titres',
        'Intro +15 s à chaque essai pendant 3 titres',
      ],
    );
  });

  test('the penalties leave a single, longer tier and no suggestion during the round', () => {
    const session = sessionAtFinale();
    withRandomAtZero(() => careerRounds.startFinale(session));
    finishTrack(session);
    withRandomAtZero(() => careerRounds.startFinale(session));

    assert.equal(careerRounds.publicCareer(session).suggestionCount, 0);
    const { state } = careerRounds.publicRound(session);
    assert.equal(state.maxAttempts, 1);
    assert.equal(state.allowedSeconds, 15.5);
  });

  test('the effects end after three tracks', () => {
    const session = sessionAtFinale();
    withRandomAtZero(() => careerRounds.startFinale(session));
    for (let i = 0; i < 4; i += 1) {
      finishTrack(session);
      withRandomAtZero(() => careerRounds.startFinale(session));
    }

    assert.equal(careerRounds.publicCareer(session).suggestionCount, 1);
    assert.equal(careerRounds.publicRound(session).state.maxAttempts, 3);
  });
});

const nijigasakiIds = songs.getPoolIds(['Nijigasaki']);

function infiniteSession(username = 'Ayumu') {
  const session = { id: 'infinite-session-0001', career: null, careerRound: null, careerNewEvents: [] };
  careerRounds.createCareer(session, { mode: 'infinite', username });
  return session;
}

// The concert of the second phase is over and the third phase is at its last turn.
function infiniteAtEndOfPhase3(username) {
  const session = infiniteSession(username);
  const { career: state } = session;
  state.release = { score: 600, grade: 'S', turn: 10, tracks: [] };
  state.concert = { score: 1500, grade: 'S', turn: 20, tracks: [] };
  state.turn = 40;
  state.stats.oreille = 500;
  return session;
}

const rowOf = (username) => leaderboard.top(100).filter((row) => row.username === username);

describe('the infinite career', () => {
  test('plays the hard rules and draws every title from the Nijigasaki discography', () => {
    const session = infiniteSession();
    withRandomAtZero(() => careerRounds.startStudy(session, 'oreille'));

    assert.equal(session.career.difficulty, 'hard');
    assert.equal(session.careerRound.songId, nijigasakiIds[0]);
    const publicState = careerRounds.publicCareer(session);
    assert.equal(publicState.mode, 'infinite');
    assert.equal(publicState.cycle, 1);
    assert.equal(publicState.finalTurn, 40);
  });

  test('keeps the username without its surrounding spaces', () => {
    assert.equal(infiniteSession('  Ayumu ').career.username, 'Ayumu');
  });

  test('a classic career has neither username nor cycle beyond the first', () => {
    const session = { id: 'classic-session-0001', career: null, careerRound: null, careerNewEvents: [] };
    careerRounds.createCareer(session, {});
    assert.equal(session.career.mode, 'classic');
    assert.equal(session.career.username, null);
  });

  test('the run joins the leaderboard when the career fails, with its score, grade and turn', () => {
    const session = infiniteAtEndOfPhase3('Failer');
    careerRounds.rest(session);

    assert.equal(session.career.failure, 'FINALE_GOALS');
    assert.deepEqual(rowOf('Failer'), [{ username: 'Failer', turn: 41, score: 2600, grade: 'D' }]);
  });

  test('a run is submitted once, even if the finished career is then abandoned', () => {
    const session = infiniteAtEndOfPhase3('Once');
    careerRounds.rest(session);
    careerRounds.abandonCareer(session);

    assert.equal(rowOf('Once').length, 1);
  });

  test('abandoning a career in progress submits its score', () => {
    const session = infiniteSession('Quitter');
    session.career.stats.memoire = 120;
    careerRounds.abandonCareer(session);

    assert.deepEqual(rowOf('Quitter'), [{ username: 'Quitter', turn: 1, score: 120, grade: 'D' }]);
    assert.equal(session.career, null);
  });

  test('a career abandoned without any score is not listed', () => {
    const session = infiniteSession('Nobody');
    careerRounds.abandonCareer(session);

    assert.deepEqual(rowOf('Nobody'), []);
  });

  test('a classic career never joins the leaderboard', () => {
    const session = { id: 'classic-session-0002', career: null, careerRound: null, careerNewEvents: [] };
    careerRounds.createCareer(session, {});
    session.career.username = 'Classic';
    session.career.stats.memoire = 120;
    careerRounds.abandonCareer(session);

    assert.deepEqual(rowOf('Classic'), []);
  });
});
