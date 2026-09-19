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
  test('failing gives 15, finding earlier gives more', () => {
    assert.equal(career.studyGain(null), 15);
    assert.equal(career.studyGain(1), 40);
    assert.equal(career.studyGain(2), 30);
    assert.equal(career.studyGain(3), 25);
    assert.equal(career.studyGain(4), 20);
    assert.equal(career.studyGain(5), 20);
  });
});

describe('singleGain', () => {
  test('failing gives 30, finding earlier gives more', () => {
    assert.equal(career.singleGain(null), 30);
    assert.equal(career.singleGain(1), 90);
    assert.equal(career.singleGain(2), 65);
    assert.equal(career.singleGain(3), 50);
    assert.equal(career.singleGain(4), 45);
    assert.equal(career.singleGain(5), 45);
  });

  test('is worth more than a study at every stage', () => {
    [null, 1, 2, 3, 4].forEach((stage) => {
      assert.ok(career.singleGain(stage) > career.studyGain(stage));
    });
  });
});

describe('a career', () => {
  test('starts at turn 1 with full energy, no stats and an empty notebook', () => {
    const state = career.createCareer();
    assert.equal(state.turn, 1);
    assert.equal(state.energy, 4);
    assert.deepEqual(state.stats, stats());
    assert.deepEqual(state.notebook, []);
  });

  test('a study costs one energy, uses the turn and adds the gain to the chosen stat', () => {
    const state = career.createCareer();
    career.study(state, 'oreille', 1, 42);
    assert.equal(state.energy, 3);
    assert.equal(state.turn, 2);
    assert.equal(state.stats.oreille, 40);
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
    assert.equal(state.energy, 4);
  });

  test('a rest always refills the energy to the maximum, and uses the turn', () => {
    const state = career.createCareer();
    state.energy = 0;
    career.rest(state);
    assert.equal(state.energy, 4);
    state.energy = 1;
    career.rest(state);
    assert.equal(state.energy, 4);
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

  test('the grade follows the share of the maximum: S from 90%, A 70%, B 50%, C 30%, else D', () => {
    assert.deepEqual(
      [600, 540, 539, 420, 419, 300, 299, 180, 179, 0].map((score) => career.grade(score, 600)),
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

  test('once released the career goes on: turns are available again and the album is closed', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1, 1, 1, 1, 1]);
    assert.equal(career.isReleaseDue(state), false);
    career.rest(state);
    assert.equal(state.turn, 12);
    assert.throws(() => career.finishAlbumTrack(state, 1, 43), { message: 'RELEASE_NOT_DUE' });
  });

  test('cannot be played before the 10 turns are spent', () => {
    const state = career.createCareer();
    assert.throws(() => career.finishAlbumTrack(state, 1, 42), { message: 'RELEASE_NOT_DUE' });
  });
});

describe('pickStat', () => {
  test('draws one of the three stats from the random value', () => {
    assert.equal(career.pickStat(() => 0), 'oreille');
    assert.equal(career.pickStat(() => 0.5), 'memoire');
    assert.equal(career.pickStat(() => 0.999), 'culture');
  });
});

describe('a single', () => {
  test('costs 2 energy, uses the turn and adds its gain to the chosen stat', () => {
    const state = career.createCareer();
    career.single(state, 'culture', 1);
    assert.equal(state.energy, 2);
    assert.equal(state.turn, 2);
    assert.equal(state.stats.culture, 90);
  });

  test('never adds a title to the notebook, even when found', () => {
    const state = career.createCareer();
    career.single(state, 'oreille', 1);
    assert.deepEqual(state.notebook, []);
  });

  test('is refused with less than 2 energy and changes nothing', () => {
    const state = career.createCareer();
    state.energy = 1;
    assert.throws(() => career.single(state, 'oreille', 1), { message: 'NO_ENERGY' });
    assert.equal(state.turn, 1);
    assert.equal(state.stats.oreille, 0);
  });

  test('is refused for an unknown stat', () => {
    const state = career.createCareer();
    assert.throws(() => career.single(state, 'souffle', 1), { message: 'INVALID_STAT' });
    assert.equal(state.energy, 4);
  });

  test('is refused once the release is due', () => {
    const state = career.createCareer();
    for (let i = 0; i < 10; i += 1) career.rest(state);
    assert.throws(() => career.assertCanSingle(state, 'oreille'), { message: 'RELEASE_DUE' });
  });
});

describe('singleFans', () => {
  test('a single wins fans, more when found earlier, a few even when missed', () => {
    assert.equal(career.singleFans(null), 10);
    assert.equal(career.singleFans(1), 40);
    assert.equal(career.singleFans(2), 30);
    assert.equal(career.singleFans(3), 25);
    assert.equal(career.singleFans(4), 20);
    assert.equal(career.singleFans(5), 20);
  });
});

describe('fans', () => {
  function careerAtRelease() {
    const state = career.createCareer();
    for (let i = 0; i < 10; i += 1) career.rest(state);
    return state;
  }

  function playAlbum(state, stages) {
    stages.forEach((stage, i) => career.finishAlbumTrack(state, stage, 100 + i));
  }

  test('a career starts without fans and without failure', () => {
    const state = career.createCareer();
    assert.equal(state.fans, 0);
    assert.equal(state.failure, null);
    assert.equal(career.FANS_REQUIRED, 300);
  });

  test('a single wins fans, a study and a rest do not', () => {
    const state = career.createCareer();
    career.single(state, 'oreille', 1);
    assert.equal(state.fans, 40);
    career.study(state, 'oreille', 1, 42);
    career.rest(state);
    assert.equal(state.fans, 40);
  });

  test('a missed single still wins a few fans', () => {
    const state = career.createCareer();
    career.single(state, 'oreille', null);
    assert.equal(state.fans, 10);
  });

  test('the album released wins half of its score in fans', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1, 1, 1, 1, 1]);
    assert.equal(state.fans, 300);
  });

  test('a track of the album alone wins no fan', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1]);
    assert.equal(state.fans, 0);
  });

  test('an album graded B (half of the maximum) reaches the objective', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1, 1, null, null, null]);
    assert.equal(state.release.grade, 'B');
    assert.equal(state.failure, null);
    assert.equal(career.isReleaseDue(state), false);
  });

  test('an album just under B fails the career', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1, 2, 5, null, null]);
    assert.equal(state.release.score, 295);
    assert.equal(state.failure, 'ALBUM_GRADE');
  });

  test('once failed nothing can be played any more', () => {
    const state = careerAtRelease();
    playAlbum(state, [null, null, null, null, null, null]);
    assert.throws(() => career.rest(state), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.study(state, 'oreille', 1, 42), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.assertCanSingle(state, 'oreille'), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.assertCanConcert(state), { message: 'CAREER_FINISHED' });
    assert.equal(career.isConcertDue(state), false);
  });

  test('after the second phase without enough fans the career fails and no concert is due', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1, 1, null, null, null]);
    for (let i = 0; i < 9; i += 1) career.rest(state);
    assert.equal(state.failure, null);
    career.rest(state);
    assert.equal(state.fans, 150);
    assert.equal(state.failure, 'FANS');
    assert.equal(career.isConcertDue(state), false);
    assert.throws(() => career.assertCanConcert(state), { message: 'CAREER_FINISHED' });
  });

  test('the fans of the very last single count for the concert', () => {
    const state = careerAtRelease();
    playAlbum(state, [1, 1, 1, null, null, null]);
    state.fans = 270;
    for (let i = 0; i < 9; i += 1) career.rest(state);
    career.single(state, 'oreille', 1);
    assert.equal(state.fans, 310);
    assert.equal(state.turn, 21);
    assert.equal(state.failure, null);
    assert.equal(career.isConcertDue(state), true);
  });
});

describe('careerScore', () => {
  test('adds the album score, the concert score, every stat and the fans', () => {
    const state = career.createCareer();
    state.stats = { oreille: 100, memoire: 50, culture: 20 };
    state.fans = 200;
    state.release = { score: 420, grade: 'A', tracks: [] };
    state.concert = { score: 1000, grade: 'A', tracks: [] };
    assert.deepEqual(career.careerScore(state), { album: 420, concert: 1000, stats: 170, fans: 200, total: 1790 });
  });

  test('a part never reached counts for nothing', () => {
    const state = career.createCareer();
    assert.deepEqual(career.careerScore(state), { album: 0, concert: 0, stats: 0, fans: 0, total: 0 });
  });

  test('a failed career is scored on what was played', () => {
    const state = career.createCareer();
    state.release = { score: 200, grade: 'C', tracks: [] };
    state.failure = 'ALBUM_GRADE';
    assert.equal(career.careerScore(state).total, 200);
  });

  test('is only final once the career is over', () => {
    const state = career.createCareer();
    assert.equal(career.isOver(state), false);
    state.failure = 'FANS';
    assert.equal(career.isOver(state), true);
    state.failure = null;
    state.concert = { score: 0, grade: 'D', tracks: [] };
    assert.equal(career.isOver(state), true);
  });
});

describe('the second phase and the concert', () => {
  function careerAfterAlbum() {
    const state = career.createCareer();
    for (let i = 0; i < 10; i += 1) career.rest(state);
    for (let i = 0; i < 6; i += 1) career.finishAlbumTrack(state, 1, 100 + i);
    return state;
  }

  function careerAtConcert() {
    const state = careerAfterAlbum();
    for (let i = 0; i < 10; i += 1) career.rest(state);
    return state;
  }

  function playConcert(state, stages) {
    stages.forEach((stage, i) => career.finishConcertTrack(state, stage, 200 + i));
  }

  test('a concert has 15 tracks for a maximum of 1500 points', () => {
    assert.equal(career.CONCERT_SIZE, 15);
    assert.equal(career.MAX_CONCERT_SCORE, 1500);
  });

  test('the second phase lasts 10 turns, then the concert is due', () => {
    const state = careerAfterAlbum();
    assert.equal(career.isConcertDue(state), false);
    for (let i = 0; i < 10; i += 1) career.rest(state);
    assert.equal(career.isConcertDue(state), true);
    assert.throws(() => career.rest(state), { message: 'CONCERT_DUE' });
    assert.throws(() => career.study(state, 'oreille', 1, 42), { message: 'CONCERT_DUE' });
    assert.throws(() => career.assertCanSingle(state, 'oreille'), { message: 'CONCERT_DUE' });
  });

  test('stats, notebook and energy carry over the release', () => {
    const state = career.createCareer();
    career.study(state, 'oreille', 1, 42);
    for (let i = 0; i < 9; i += 1) career.rest(state);
    for (let i = 0; i < 6; i += 1) career.finishAlbumTrack(state, 1, 100 + i);
    assert.equal(state.stats.oreille, 40);
    assert.deepEqual(state.notebook, [42]);
    assert.equal(state.energy, 4);
  });

  test('the concert cannot be played before its 10 turns are spent', () => {
    const state = careerAfterAlbum();
    assert.throws(() => career.finishConcertTrack(state, 1, 42), { message: 'CONCERT_NOT_DUE' });
  });

  test('the concert cannot be played before the album is released', () => {
    const state = career.createCareer();
    for (let i = 0; i < 20; i += 1) state.turn += 1;
    assert.throws(() => career.assertCanConcert(state), { message: 'CONCERT_NOT_DUE' });
  });

  test('a track is recorded with its song, rank and points, and the concert goes on', () => {
    const state = careerAtConcert();
    career.finishConcertTrack(state, 3, 42);
    assert.deepEqual(state.concertTracks, [{ songId: 42, rank: 'B', points: 50 }]);
    assert.equal(state.concert, undefined);
  });

  test('the concert ends after its 15th track, with the total score and grade', () => {
    const state = careerAtConcert();
    playConcert(state, [...Array(14).fill(1), null]);
    assert.equal(state.concert.score, 1400);
    assert.equal(state.concert.grade, 'S');
    assert.equal(state.concert.tracks.length, 15);
  });

  test('a fully missed concert is graded D', () => {
    const state = careerAtConcert();
    playConcert(state, Array(15).fill(null));
    assert.equal(state.concert.score, 0);
    assert.equal(state.concert.grade, 'D');
  });

  test('once the concert is over the career is finished', () => {
    const state = careerAtConcert();
    playConcert(state, Array(15).fill(1));
    assert.throws(() => career.rest(state), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.finishConcertTrack(state, 1, 43), { message: 'CAREER_FINISHED' });
    assert.throws(() => career.assertCanConcert(state), { message: 'CAREER_FINISHED' });
  });
});

describe('pickPreparedSongId', () => {
  const POOL = [1, 2, 3, 4, 5, 6, 7, 8];

  test('draws from the studied titles first', () => {
    for (let i = 0; i < 30; i += 1) {
      assert.ok([2, 5].includes(career.pickPreparedSongId(POOL, [2, 5], [])));
    }
  });

  test('never repeats a title already used on the same album or concert', () => {
    for (let i = 0; i < 30; i += 1) {
      assert.equal(career.pickPreparedSongId(POOL, [2, 5], [2]), 5);
    }
  });

  test('completes with a random title of the pool once the studied ones are used', () => {
    const picked = new Set();
    for (let i = 0; i < 100; i += 1) picked.add(career.pickPreparedSongId(POOL, [2], [2]));
    assert.ok(![...picked].includes(2));
    assert.ok(picked.size > 1);
    assert.ok([...picked].every((id) => POOL.includes(id)));
  });

  test('completes at random from the whole pool when nothing was studied', () => {
    assert.ok(POOL.includes(career.pickPreparedSongId(POOL, [], [])));
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
