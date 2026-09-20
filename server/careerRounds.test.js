const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const career = require('./career');
const careerRounds = require('./careerRounds');
const songs = require('./songs');

const discographyIds = career.discographyIds(songs.getPlayableTitles());

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
  state.turn = 51;
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
        'Oreille −500 pendant 3 titres',
        'Mémoire −500 pendant 3 titres',
        'Culture −500 pendant 3 titres',
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
