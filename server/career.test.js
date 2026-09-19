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
  test('starts with 3 growing tiers of 1, 2 and 3 seconds', () => {
    assert.deepEqual(career.roundTiers(stats()), [1, 2, 3]);
  });

  test('99 hearing gives nothing, 100 adds 0.5 s to the first tier', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: 99 })), [1, 2, 3]);
    assert.deepEqual(career.roundTiers(stats({ oreille: 100 })), [1.5, 2, 3]);
  });

  test('hearing adds 0.5 s to the second tier at 200 and to the third at 300', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: 200 })), [1.5, 2.5, 3]);
    assert.deepEqual(career.roundTiers(stats({ oreille: 300 })), [1.5, 2.5, 3.5]);
  });

  test('culture adds a 4th tier of 4 s at 100 and a 5th of 5 s at 200, and no more', () => {
    assert.deepEqual(career.roundTiers(stats({ culture: 100 })), [1, 2, 3, 4]);
    assert.deepEqual(career.roundTiers(stats({ culture: 200 })), [1, 2, 3, 4, 5]);
    assert.deepEqual(career.roundTiers(stats({ culture: 900 })), [1, 2, 3, 4, 5]);
  });

  test('a culture tier stays longer than the last hearing-boosted one', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: 300, culture: 100 })), [1.5, 2.5, 3.5, 4]);
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

  test('a rest gives 3 energy without exceeding the maximum, and uses the turn', () => {
    const state = career.createCareer();
    state.energy = 0;
    career.rest(state);
    assert.equal(state.energy, 3);
    state.energy = 1;
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

  function playAlbum(state, stages) {
    stages.forEach((stage, i) => career.finishAlbumTrack(state, stage, 100 + i));
  }

  test('an album has 6 tracks', () => {
    assert.equal(career.ALBUM_SIZE, 6);
  });

  test('a track found earlier is worth more points, a missed one nothing', () => {
    assert.deepEqual([1, 2, 3, 4, 5, null].map(career.trackPoints), [100, 70, 50, 35, 25, 0]);
  });

  test('a track is recorded with its song, rank and points, and the album goes on', () => {
    const state = careerAtRelease();
    career.finishAlbumTrack(state, 2, 42);
    assert.deepEqual(state.album, [{ songId: 42, rank: 'A', points: 70 }]);
    assert.equal(state.release, undefined);
  });

  test('the album is released after its 6th track, with the total score', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 2, 3, 4, 5, null]);
    assert.equal(state.release.score, 100 + 70 + 50 + 35 + 25);
    assert.equal(state.release.tracks.length, 6);
    assert.deepEqual(state.release.tracks[5], { songId: 105, rank: 'FAIL', points: 0 });
  });

  test('the grade follows the share of the 600 points: S from 90%, A 70%, B 50%, C 30%, else D', () => {
    assert.deepEqual(
      [600, 540, 539, 420, 419, 300, 299, 180, 179, 0].map(career.albumGrade),
      ['S', 'S', 'A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'],
    );
  });

  test('a perfect album is graded S and a missed one D', () => {
    const perfect = careerAtRelease();
    playAlbum(perfect, [1, 1, 1, 1, 1, 1]);
    assert.equal(perfect.release.score, 600);
    assert.equal(perfect.release.grade, 'S');

    const missed = careerAtRelease();
    playAlbum(missed, [null, null, null, null, null, null]);
    assert.equal(missed.release.grade, 'D');
  });

  test('once released the career is finished: no rest, no study, no more track', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1, 1, 1, 1, 1]);
    assert.throws(() => career.rest(state), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.study(state, 'oreille', 1, 43), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.finishAlbumTrack(state, 1, 43), { message: 'CAREER_FINISHED' });
  });

  test('cannot be played before the 10 turns are spent', () => {
    const state = career.createCareer();
    assert.throws(() => career.finishAlbumTrack(state, 1, 42), { message: 'RELEASE_NOT_DUE' });
  });
});

describe('pickAlbumSongId', () => {
  const POOL = [1, 2, 3, 4, 5, 6, 7, 8];

  test('draws from the studied titles first', () => {
    for (let i = 0; i < 30; i += 1) {
      assert.ok([2, 5].includes(career.pickAlbumSongId(POOL, [2, 5], [])));
    }
  });

  test('never repeats a title already on the album', () => {
    for (let i = 0; i < 30; i += 1) {
      assert.equal(career.pickAlbumSongId(POOL, [2, 5], [2]), 5);
    }
  });

  test('completes with a random title of the pool once the studied ones are used', () => {
    const picked = new Set();
    for (let i = 0; i < 100; i += 1) picked.add(career.pickAlbumSongId(POOL, [2], [2]));
    assert.ok(![...picked].includes(2));
    assert.ok(picked.size > 1);
    assert.ok([...picked].every((id) => POOL.includes(id)));
  });

  test('completes at random from the whole pool when nothing was studied', () => {
    assert.ok(POOL.includes(career.pickAlbumSongId(POOL, [], [])));
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
