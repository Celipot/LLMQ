const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const career = require('./career');

const AYUMU = 'Ayumu Uehara (CV: Aguri Onishi)';
const AZUNA = 'A・ZU・NA';
const GROUP = 'Nijigasaki High School Idol Club';

function stats(overrides = {}) {
  return { oreille: 0, memoire: 0, culture: 0, ...overrides };
}

describe('discographyIds', () => {
  test('keeps Ayumu solos, A・ZU・NA and the Nijigasaki group, nothing else', () => {
    const songs = [
      { id: 1, artist: AYUMU },
      { id: 2, artist: AZUNA },
      { id: 3, artist: GROUP },
      { id: 4, artist: 'Shizuku Osaka (CV: Kaori Maeda)' },
      { id: 5, artist: 'DiverDiva' },
    ];
    assert.deepEqual(career.discographyIds(songs), [1, 2, 3]);
  });

  test('matches the 64 titles of the real library', () => {
    const songs = require('../data/songs.json');
    assert.equal(career.discographyIds(songs).length, 64);
  });
});

describe('roundTiers', () => {
  test('starts with 3 tiers of 1 second', () => {
    assert.deepEqual(career.roundTiers(stats()), [1, 1, 1]);
  });

  test('99 hearing gives nothing, 100 adds 0.5 s to the first tier', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: 99 })), [1, 1, 1]);
    assert.deepEqual(career.roundTiers(stats({ oreille: 100 })), [1.5, 1, 1]);
  });

  test('hearing adds 0.5 s to the second tier at 200 and to the third at 300', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: 200 })), [1.5, 1.5, 1]);
    assert.deepEqual(career.roundTiers(stats({ oreille: 300 })), [1.5, 1.5, 1.5]);
  });

  test('culture adds a 4th tier at 100 and a 5th at 200, and no more', () => {
    assert.deepEqual(career.roundTiers(stats({ culture: 100 })), [1, 1, 1, 1]);
    assert.deepEqual(career.roundTiers(stats({ culture: 200 })), [1, 1, 1, 1, 1]);
    assert.deepEqual(career.roundTiers(stats({ culture: 900 })), [1, 1, 1, 1, 1]);
  });
});

describe('suggestionCount', () => {
  test('starts at 1 and grows by one every 100 memory, up to 4', () => {
    assert.equal(career.suggestionCount(stats()), 1);
    assert.equal(career.suggestionCount(stats({ memoire: 99 })), 1);
    assert.equal(career.suggestionCount(stats({ memoire: 100 })), 2);
    assert.equal(career.suggestionCount(stats({ memoire: 300 })), 4);
    assert.equal(career.suggestionCount(stats({ memoire: 900 })), 4);
  });
});

describe('studyGain', () => {
  test('failing gives 30, finding earlier gives more', () => {
    assert.equal(career.studyGain(null), 30);
    assert.equal(career.studyGain(1), 80);
    assert.equal(career.studyGain(2), 60);
    assert.equal(career.studyGain(3), 45);
    assert.equal(career.studyGain(4), 40);
    assert.equal(career.studyGain(5), 40);
  });
});

describe('a career', () => {
  test('starts at turn 1 with full energy, no stats and an empty notebook', () => {
    const state = career.createCareer();
    assert.equal(state.turn, 1);
    assert.equal(state.energy, 3);
    assert.deepEqual(state.stats, stats());
    assert.deepEqual(state.notebook, []);
  });

  test('a study costs one energy, uses the turn and adds the gain to the chosen stat', () => {
    const state = career.createCareer();
    career.study(state, 'oreille', 1, 42);
    assert.equal(state.energy, 2);
    assert.equal(state.turn, 2);
    assert.equal(state.stats.oreille, 80);
  });

  test('a found song joins the notebook, a failed study does not', () => {
    const state = career.createCareer();
    career.study(state, 'memoire', 2, 42);
    career.study(state, 'memoire', null, 43);
    assert.deepEqual(state.notebook, [42]);
  });

  test('a study without energy is refused and changes nothing', () => {
    const state = career.createCareer();
    state.energy = 0;
    assert.throws(() => career.study(state, 'oreille', 1, 42), { message: 'NO_ENERGY' });
    assert.equal(state.turn, 1);
    assert.equal(state.stats.oreille, 0);
  });

  test('an unknown stat is refused', () => {
    const state = career.createCareer();
    assert.throws(() => career.study(state, 'souffle', 1, 42), { message: 'INVALID_STAT' });
    assert.equal(state.energy, 3);
  });

  test('a rest gives 2 energy without exceeding the maximum, and uses the turn', () => {
    const state = career.createCareer();
    state.energy = 0;
    career.rest(state);
    assert.equal(state.energy, 2);
    career.rest(state);
    assert.equal(state.energy, 3);
    assert.equal(state.turn, 3);
  });

  test('after 10 turns the release is due and no more study or rest is possible', () => {
    const state = career.createCareer();
    assert.equal(career.isReleaseDue(state), false);
    for (let i = 0; i < 10; i += 1) career.rest(state);
    assert.equal(career.isReleaseDue(state), true);
    assert.throws(() => career.rest(state), { message: 'RELEASE_DUE' });
    assert.throws(() => career.study(state, 'oreille', 1, 42), { message: 'RELEASE_DUE' });
  });
});

describe('the release', () => {
  function careerAtRelease() {
    const state = career.createCareer();
    for (let i = 0; i < 10; i += 1) career.rest(state);
    return state;
  }

  test('records the rank and adds the found song to the notebook', () => {
    const state = careerAtRelease();
    career.finishRelease(state, 2, 42);
    assert.deepEqual(state.release, { rank: 'A', songId: 42 });
    assert.deepEqual(state.notebook, [42]);
  });

  test('a failed release records FAIL and leaves the notebook untouched', () => {
    const state = careerAtRelease();
    career.finishRelease(state, null, 42);
    assert.deepEqual(state.release, { rank: 'FAIL', songId: 42 });
    assert.deepEqual(state.notebook, []);
  });

  test('once released the career is finished: no rest, no study', () => {
    const state = careerAtRelease();
    career.finishRelease(state, 1, 42);
    assert.throws(() => career.rest(state), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.study(state, 'oreille', 1, 43), { message: 'CAREER_FINISHED' });
  });

  test('cannot be played before the 10 turns are spent', () => {
    const state = career.createCareer();
    assert.throws(() => career.finishRelease(state, 1, 42), { message: 'RELEASE_NOT_DUE' });
  });

  test('cannot be played twice', () => {
    const state = careerAtRelease();
    career.finishRelease(state, 1, 42);
    assert.throws(() => career.finishRelease(state, 1, 43), { message: 'CAREER_FINISHED' });
  });
});

describe('releaseRank', () => {
  test('maps the stage the title was found at to a rank', () => {
    assert.equal(career.releaseRank(1), 'S');
    assert.equal(career.releaseRank(2), 'A');
    assert.equal(career.releaseRank(3), 'B');
    assert.equal(career.releaseRank(4), 'C');
    assert.equal(career.releaseRank(5), 'C');
    assert.equal(career.releaseRank(null), 'FAIL');
  });
});

describe('pickSongId', () => {
  test('never returns an already found title while others remain', () => {
    const picked = new Set();
    for (let i = 0; i < 50; i += 1) picked.add(career.pickSongId([1, 2, 3], [1, 2]));
    assert.deepEqual([...picked], [3]);
  });

  test('falls back to the whole pool once every title is found', () => {
    assert.equal(career.pickSongId([7], [7]), 7);
  });
});
