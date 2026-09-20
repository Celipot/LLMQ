const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const career = require('./career');

const AYUMU = 'Ayumu Uehara (CV: Aguri Onishi)';
const AZUNA = 'A・ZU・NA';
const GROUP = 'Nijigasaki High School Idol Club';
const SHIZUKU = 'Shizuku Osaka (CV: Kaori Maeda)';
const SETSUNA = 'Setsuna Yuki (CV: Tomori Kusunoki)';
const SETSUNA_LATER_VOICE = 'Setsuna Yuki (CV: Coco Hayashi)';

function stats(overrides = {}) {
  return { oreille: 0, memoire: 0, culture: 0, ...overrides };
}

describe('discographyIds', () => {
  test('keeps the solos of Ayumu, Shizuku and Setsuna (both voices), A・ZU・NA and the Nijigasaki group, nothing else', () => {
    const songs = [
      { id: 1, artist: AYUMU },
      { id: 2, artist: AZUNA },
      { id: 3, artist: GROUP },
      { id: 4, artist: SHIZUKU },
      { id: 5, artist: SETSUNA },
      { id: 6, artist: SETSUNA_LATER_VOICE },
      { id: 7, artist: 'Karin Asaka (CV: Miyu Kubota)' },
      { id: 8, artist: 'DiverDiva' },
    ];
    assert.deepEqual(career.discographyIds(songs), [1, 2, 3, 4, 5, 6]);
  });

  test('matches the 82 titles of the real library', () => {
    const songs = require('../data/songs.json');
    assert.equal(career.discographyIds(songs).length, 82);
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
    assert.equal(career.DIFFICULTIES.hard.fansRequired, 350);
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
    state.fans = career.DIFFICULTIES.hard.fansRequired - 30;
    for (let i = 0; i < 9; i += 1) career.rest(state);
    career.single(state, 'oreille', 1);
    assert.equal(state.fans, career.DIFFICULTIES.hard.fansRequired + 10);
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
    assert.deepEqual(career.careerScore(state), {
      album: 420,
      concert: 1000,
      sorties: 0,
      finale: 0,
      stats: 170,
      fans: 200,
      total: 1790,
    });
  });

  test('a part never reached counts for nothing', () => {
    const state = career.createCareer();
    assert.deepEqual(career.careerScore(state), {
      album: 0,
      concert: 0,
      sorties: 0,
      finale: 0,
      stats: 0,
      fans: 0,
      total: 0,
    });
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
    assert.equal(career.isOver(state), false);
    state.finale = { score: 0, grade: 'D', tracks: [] };
    assert.equal(career.isOver(state), true);
  });
});

describe('the second phase and the concert', () => {
  function careerAfterAlbum() {
    const state = career.createCareer();
    for (let i = 0; i < 10; i += 1) career.rest(state);
    for (let i = 0; i < 6; i += 1) career.finishAlbumTrack(state, 1, 100 + i);
    state.fans = career.DIFFICULTIES.hard.fansRequired;
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

  test('once the concert is over the career goes on with a third phase', () => {
    const state = careerAtConcert();
    playConcert(state, Array(15).fill(1));
    assert.equal(career.isOver(state), false);
    assert.equal(career.isConcertDue(state), false);
    assert.throws(() => career.finishConcertTrack(state, 1, 43), { message: 'CONCERT_NOT_DUE' });
    career.rest(state);
    assert.equal(state.turn, 22);
  });
});

function careerInPhase3() {
  const state = career.createCareer();
  for (let i = 0; i < 10; i += 1) career.rest(state);
  for (let i = 0; i < 6; i += 1) career.finishAlbumTrack(state, 1, 100 + i);
  state.fans = career.DIFFICULTIES.hard.fansRequired;
  for (let i = 0; i < 10; i += 1) career.rest(state);
  for (let i = 0; i < 15; i += 1) career.finishConcertTrack(state, 1, 200 + i);
  return state;
}

function playLive(state, kind, stages) {
  stages.forEach((stage, i) => {
    career.startLive(state, kind);
    career.finishLiveTrack(state, stage, 300 + i);
  });
}

describe('the third phase', () => {
  test('lasts from turn 21 to turn 50', () => {
    assert.equal(career.FINAL_TURN, 50);
    assert.equal(career.isPhase3(careerInPhase3()), true);
    assert.equal(career.isPhase3(career.createCareer()), false);
  });

  test('an album or a concert cannot be started before the concert of the second phase', () => {
    const state = career.createCareer();
    assert.throws(() => career.startLive(state, 'album'), { message: 'RELEASE_NOT_DUE' });
    assert.throws(() => career.startLive(state, 'concert'), { message: 'CONCERT_NOT_DUE' });
  });

  test('an album costs 3 energy, paid when the first track starts', () => {
    const state = careerInPhase3();
    career.startLive(state, 'album');
    assert.equal(state.energy, 1);
  });

  test('a concert costs 4 energy', () => {
    const state = careerInPhase3();
    career.startLive(state, 'concert');
    assert.equal(state.energy, 0);
  });

  test('is refused without enough energy and starts nothing', () => {
    const state = careerInPhase3();
    state.energy = 2;
    assert.throws(() => career.startLive(state, 'album'), { message: 'NO_ENERGY' });
    assert.equal(state.live, null);
    assert.equal(state.energy, 2);
  });

  test('going on with the same sortie does not cost energy again', () => {
    const state = careerInPhase3();
    career.startLive(state, 'album');
    career.finishLiveTrack(state, 1, 301);
    career.startLive(state, 'album');
    assert.equal(state.energy, 1);
    assert.equal(state.live.tracks.length, 1);
  });

  test('nothing else can be done while a sortie is in progress', () => {
    const state = careerInPhase3();
    career.startLive(state, 'album');
    career.finishLiveTrack(state, 1, 301);
    assert.throws(() => career.rest(state), { message: 'RELEASE_IN_PROGRESS' });
    assert.throws(() => career.study(state, 'oreille', 1, 42), { message: 'RELEASE_IN_PROGRESS' });
    assert.throws(() => career.startLive(state, 'concert'), { message: 'RELEASE_IN_PROGRESS' });
  });

  test('an album is released after its 6th track: score, grade, half of the score in fans, one turn', () => {
    const state = careerInPhase3();
    const fansBefore = state.fans;
    playLive(state, 'album', [1, 1, 1, 1, 1, 1]);
    assert.equal(state.live, null);
    assert.equal(state.turn, 22);
    assert.equal(state.fans, fansBefore + 300);
    assert.equal(state.sorties[0].turn, 21);
    assert.equal(state.sorties.length, 1);
    assert.equal(state.sorties[0].kind, 'album');
    assert.equal(state.sorties[0].score, 600);
    assert.equal(state.sorties[0].grade, 'S');
    assert.equal(state.sorties[0].tracks.length, 6);
  });

  test('a concert has 15 tracks, wins no fan and uses one turn', () => {
    const state = careerInPhase3();
    const fansBefore = state.fans;
    playLive(state, 'concert', Array(15).fill(2));
    assert.equal(state.sorties[0].kind, 'concert');
    assert.equal(state.sorties[0].score, 1050);
    assert.equal(state.sorties[0].grade, 'A');
    assert.equal(state.fans, fansBefore);
    assert.equal(state.turn, 22);
  });

  test('a failed album in the third phase does not fail the career', () => {
    const state = careerInPhase3();
    playLive(state, 'album', Array(6).fill(null));
    assert.equal(state.failure, null);
    assert.equal(state.sorties[0].grade, 'D');
  });

  test('the titles already played in the sortie in progress are known', () => {
    const state = careerInPhase3();
    career.startLive(state, 'album');
    career.finishLiveTrack(state, 1, 301);
    assert.deepEqual(career.liveSongIds(state), [301]);
  });

  test('goals: 2 concerts and 3 albums, of which 2 and 2 graded B or better', () => {
    const state = careerInPhase3();
    assert.deepEqual(career.finaleGoals(state), {
      concerts: { done: 0, good: 0, required: 2, requiredGood: 2 },
      albums: { done: 0, good: 0, required: 3, requiredGood: 2 },
      met: false,
    });
    state.sorties = [
      { kind: 'concert', score: 800, grade: 'B' },
      { kind: 'concert', score: 100, grade: 'D' },
      { kind: 'album', score: 400, grade: 'B' },
      { kind: 'album', score: 400, grade: 'B' },
      { kind: 'album', score: 0, grade: 'D' },
    ];
    assert.equal(career.finaleGoals(state).met, false);
    state.sorties.push({ kind: 'concert', score: 800, grade: 'B' });
    assert.equal(career.finaleGoals(state).met, true);
    assert.deepEqual(career.finaleGoals(state).concerts, { done: 3, good: 2, required: 2, requiredGood: 2 });
  });

  test('the finale is not due before turn 51 and cannot be started', () => {
    const state = careerInPhase3();
    assert.equal(career.isFinaleDue(state), false);
    assert.throws(() => career.startLive(state, 'finale'), { message: 'FINALE_NOT_DUE' });
  });

  test('turn 51 without the goals fails the career', () => {
    const state = careerInPhase3();
    state.turn = 50;
    career.rest(state);
    assert.equal(state.failure, 'FINALE_GOALS');
    assert.equal(career.isFinaleDue(state), false);
    assert.throws(() => career.rest(state), { message: 'CAREER_FINISHED' });
  });

  function careerAtFinale() {
    const state = careerInPhase3();
    state.sorties = [
      { kind: 'concert', score: 800, grade: 'B' },
      { kind: 'concert', score: 800, grade: 'B' },
      { kind: 'album', score: 400, grade: 'B' },
      { kind: 'album', score: 400, grade: 'B' },
      { kind: 'album', score: 0, grade: 'D' },
    ];
    state.turn = 50;
    career.rest(state);
    return state;
  }

  test('turn 51 with the goals makes the finale due, and nothing else is possible', () => {
    const state = careerAtFinale();
    assert.equal(state.failure, null);
    assert.equal(career.isFinaleDue(state), true);
    assert.throws(() => career.rest(state), { message: 'FINALE_DUE' });
    assert.throws(() => career.startLive(state, 'album'), { message: 'FINALE_DUE' });
  });

  test('the finale has 50 tracks for 5000 points, costs no energy and ends the career', () => {
    assert.equal(career.FINALE_SIZE, 50);
    assert.equal(career.MAX_FINALE_SCORE, 5000);
    const state = careerAtFinale();
    state.energy = 0;
    playLive(state, 'finale', [...Array(49).fill(1), null]);
    assert.equal(state.finale.score, 4900);
    assert.equal(state.finale.grade, 'S');
    assert.equal(state.live, null);
    assert.equal(career.isOver(state), true);
    assert.throws(() => career.rest(state), { message: 'CAREER_FINISHED' });
  });

  test('the career score adds the sorties of the third phase and the finale', () => {
    const state = careerAtFinale();
    playLive(state, 'finale', Array(50).fill(1));
    assert.deepEqual(career.careerScore(state), {
      album: 600,
      concert: 1500,
      sorties: 2400,
      finale: 5000,
      stats: 0,
      fans: career.DIFFICULTIES.hard.fansRequired,
      total: 9850,
    });
  });
});

describe('the effective stats', () => {
  test('a temporary penalty lowers a stat until its expiry turn, without touching the base', () => {
    const state = career.createCareer();
    state.stats.oreille = 350;
    state.turn = 33;
    state.modifiers = [{ stat: 'oreille', delta: -400, expiresAtTurn: 38 }];
    assert.equal(career.effectiveStats(state).oreille, -50);
    assert.equal(state.stats.oreille, 350);
    state.turn = 38;
    assert.equal(career.effectiveStats(state).oreille, 350);
  });

  test('an effective stat never goes under -100', () => {
    const state = career.createCareer();
    state.turn = 33;
    state.modifiers = [{ stat: 'culture', delta: -400, expiresAtTurn: 38 }];
    assert.equal(career.effectiveStats(state).culture, -100);
  });

  test('the maximum of a stat is its last bonus step', () => {
    assert.deepEqual(career.STAT_MAX, { oreille: 300, memoire: 300, culture: 200 });
  });

  test('a negative hearing shortens the first tier to 0.5 s', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: -100 })), [0.5, 2, 3]);
  });

  test('a negative culture leaves a single tier', () => {
    assert.deepEqual(career.roundTiers(stats({ culture: -100 })), [1]);
  });

  test('a negative memory removes every suggestion', () => {
    assert.equal(career.suggestionCount(stats({ memoire: -100 })), 0);
  });
});

describe('pickPreparedSongId', () => {
  const POOL = [1, 2, 3, 4, 5, 6, 7, 8];
  const NOTEBOOK = [1, 2, 3, 4];

  // Plays a whole sortie of `total` tracks; `coin` is what the notebook-or-pool draw
  // sees, the title itself is always the last candidate of its source.
  function playSortie(total, coin, notebook = NOTEBOOK) {
    const used = [];
    for (let i = 0; i < total; i += 1) {
      const draws = [coin(), 0.999];
      used.push(career.pickPreparedSongId(POOL, notebook, used, total, () => draws.shift()));
    }
    return used;
  }

  const fromNotebook = (used, notebook = NOTEBOOK) => used.filter((id) => notebook.includes(id)).length;

  test('takes half of the tracks from the notebook when the coin favours it', () => {
    assert.equal(fromNotebook(playSortie(6, () => 0)), 3);
  });

  test('rounds the notebook half up on an odd total', () => {
    assert.equal(fromNotebook(playSortie(5, () => 0)), 3);
  });

  test('still takes the notebook quota when the coin never favours it', () => {
    assert.equal(fromNotebook(playSortie(6, () => 0.999)), 3);
  });

  test('never repeats a title already used on the same sortie', () => {
    for (let i = 0; i < 30; i += 1) {
      const used = playSortie(6, Math.random);
      assert.equal(new Set(used).size, used.length);
    }
  });

  test('completes with the pool when the notebook is smaller than its quota', () => {
    const used = playSortie(6, () => 0, [2]);
    assert.equal(fromNotebook(used, [2]), 1);
    assert.equal(new Set(used).size, 6);
  });

  test('draws from the whole pool when the notebook is empty', () => {
    assert.ok(POOL.includes(career.pickPreparedSongId(POOL, [], [], 6)));
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

describe('the turn of a release', () => {
  test('the album and the concert of the first two phases are dated 10 and 20', () => {
    const state = careerInPhase3();
    assert.equal(state.release.turn, 10);
    assert.equal(state.concert.turn, 20);
  });

  test('a sortie of the third phase is dated with the turn it was played on', () => {
    const state = careerInPhase3();
    state.turn = 33;
    state.energy = 4;
    playLive(state, 'album', Array(6).fill(1));
    assert.equal(state.sorties[0].turn, 33);
    assert.equal(state.turn, 34);
  });

  test('the finale is dated 50', () => {
    const state = careerInPhase3();
    state.sorties = [
      { kind: 'concert', score: 800, grade: 'B' },
      { kind: 'concert', score: 800, grade: 'B' },
      { kind: 'album', score: 400, grade: 'B' },
      { kind: 'album', score: 400, grade: 'B' },
      { kind: 'album', score: 0, grade: 'D' },
    ];
    state.turn = 50;
    career.rest(state);
    playLive(state, 'finale', Array(50).fill(1));
    assert.equal(state.finale.turn, 50);
  });
});

describe('the effects that last a few tracks of the finale', () => {
  function inFinale(tracksPlayed) {
    const state = career.createCareer();
    state.live = {
      kind: 'finale',
      tracks: Array.from({ length: tracksPlayed }, (_, i) => ({ songId: i })),
      penalties: [],
      bonus: null,
    };
    state.stats.oreille = 300;
    return state;
  }

  test('a starting sortie has no effect', () => {
    const state = careerInPhase3();
    career.startLive(state, 'album');
    assert.deepEqual(state.live.penalties, []);
    assert.equal(state.live.bonus, null);
  });

  test('a penalty lowers the stat until its last track, then stops', () => {
    const state = inFinale(2);
    state.live.penalties = [{ stat: 'oreille', delta: -500, untilTrack: 4 }];
    assert.equal(career.effectiveStats(state).oreille, -100);
    state.live.tracks.push({ songId: 9 });
    assert.equal(career.effectiveStats(state).oreille, -100);
    state.live.tracks.push({ songId: 10 });
    assert.equal(career.effectiveStats(state).oreille, 300);
  });

  test('a bonus adds seconds to every tier until its last track', () => {
    const state = inFinale(2);
    state.live.bonus = { seconds: 15, untilTrack: 4 };
    assert.equal(career.roundBonusSeconds(state), 15);
    state.live.tracks.push({ songId: 9 });
    assert.equal(career.roundBonusSeconds(state), 15);
    state.live.tracks.push({ songId: 10 });
    assert.equal(career.roundBonusSeconds(state), 0);
  });

  test('outside a sortie there is no bonus', () => {
    assert.equal(career.roundBonusSeconds(career.createCareer()), 0);
  });

  test('the bonus lengthens every tier of the round', () => {
    assert.deepEqual(career.roundTiers(stats(), 15), [16, 17, 18]);
    assert.deepEqual(career.roundTiers(stats({ culture: 100 }), 15), [16, 17, 18, 19]);
  });
});

describe('difficulties', () => {
  const { hard, normal } = career.DIFFICULTIES;

  test('hard is the rule set the career always had', () => {
    assert.equal(hard.fansRequired, 350);
    assert.equal(hard.albumGoalGrade, 'B');
    assert.deepEqual(hard.finaleGoals, {
      concerts: { required: 2, requiredGood: 2 },
      albums: { required: 3, requiredGood: 2 },
    });
    assert.deepEqual(hard.baseTiers, [1, 2, 3]);
    assert.equal(hard.baseSuggestions, 1);
    assert.equal(hard.negativeEvents, true);
    assert.equal(hard.hint, false);
  });

  test('normal asks for fewer fans, a lower grade and easier finale goals', () => {
    assert.equal(normal.fansRequired, 200);
    assert.equal(normal.albumGoalGrade, 'C');
    assert.deepEqual(normal.finaleGoals, {
      concerts: { required: 2, requiredGood: 1 },
      albums: { required: 3, requiredGood: 1 },
    });
  });

  test('normal starts with longer clips, one more try, more suggestions, no negative events and a hint', () => {
    assert.deepEqual(normal.baseTiers, [2, 3, 4, 5]);
    assert.equal(normal.baseSuggestions, 3);
    assert.equal(normal.negativeEvents, false);
    assert.equal(normal.hint, true);
  });

  test('isValidDifficulty only accepts a known difficulty', () => {
    assert.equal(career.isValidDifficulty('normal'), true);
    assert.equal(career.isValidDifficulty('hard'), true);
    assert.equal(career.isValidDifficulty('easy'), false);
    assert.equal(career.isValidDifficulty('toString'), false);
    assert.equal(career.isValidDifficulty(undefined), false);
  });

  test('a career is hard unless told otherwise', () => {
    assert.equal(career.createCareer().difficulty, 'hard');
    assert.equal(career.createCareer('normal').difficulty, 'normal');
  });

  function albumThenRest(difficulty, stages, fans) {
    const state = career.createCareer(difficulty);
    for (let i = 0; i < 10; i += 1) career.rest(state);
    stages.forEach((stage, i) => career.finishAlbumTrack(state, stage, 100 + i));
    state.fans = fans;
    return state;
  }

  test('a C album is a failure on hard and enough on normal', () => {
    const stages = [1, 1, null, null, null, null];
    assert.equal(albumThenRest('hard', stages, 0).failure, 'ALBUM_GRADE');
    assert.equal(albumThenRest('normal', stages, 0).failure, null);
  });

  test('normal needs 200 fans at the end of the second phase', () => {
    const stages = [1, 1, 1, 1, 1, 1];
    const short = albumThenRest('normal', stages, 199);
    for (let i = 0; i < 10; i += 1) career.rest(short);
    assert.equal(short.failure, 'FANS');

    const enough = albumThenRest('normal', stages, 200);
    for (let i = 0; i < 10; i += 1) career.rest(enough);
    assert.equal(enough.failure, null);
  });

  test('a C sortie counts for the finale goals on normal, not on hard', () => {
    const sorties = [
      { kind: 'concert', grade: 'C' },
      { kind: 'concert', grade: 'D' },
      { kind: 'album', grade: 'C' },
      { kind: 'album', grade: 'D' },
      { kind: 'album', grade: 'D' },
    ];
    const normalState = { ...career.createCareer('normal'), sorties };
    const hardState = { ...career.createCareer('hard'), sorties };

    assert.equal(career.finaleGoals(normalState).met, true);
    assert.equal(career.finaleGoals(hardState).met, false);
  });
});

describe('the base of the stats by difficulty', () => {
  const { normal } = career.DIFFICULTIES;

  test('normal starts with 4 tries of 2, 3, 4 and 5 seconds', () => {
    assert.deepEqual(career.roundTiers(stats(), 0, normal), [2, 3, 4, 5]);
  });

  test('hearing lengthens the first three tiers of normal too', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: 300 }), 0, normal), [2.5, 3.5, 4.5, 5]);
    assert.deepEqual(career.roundTiers(stats({ oreille: 400 }), 0, normal), [2.5, 3.5, 4.5, 5]);
  });

  test('endurance adds tries that last longer than the last one of normal', () => {
    assert.deepEqual(career.roundTiers(stats({ culture: 200 }), 0, normal), [2, 3, 4, 5, 6, 7]);
  });

  test('a negative endurance still leaves one try on normal', () => {
    assert.deepEqual(career.roundTiers(stats({ culture: -100 }), 0, normal), [2]);
  });

  test('a negative hearing shortens the first tier of normal', () => {
    assert.deepEqual(career.roundTiers(stats({ oreille: -100 }), 0, normal), [1.5, 3, 4, 5]);
  });

  test('the bonus seconds of an event lengthen every tier of normal', () => {
    assert.deepEqual(career.roundTiers(stats(), 15, normal), [17, 18, 19, 20]);
  });

  test('normal starts with 3 suggestions and knowledge adds up to 3 more', () => {
    assert.equal(career.suggestionCount(stats(), normal), 3);
    assert.equal(career.suggestionCount(stats({ memoire: 100 }), normal), 4);
    assert.equal(career.suggestionCount(stats({ memoire: 300 }), normal), 6);
  });

  test('a negative knowledge removes every suggestion on normal', () => {
    assert.equal(career.suggestionCount(stats({ memoire: -100 }), normal), 0);
  });

  test('hard is unchanged: the default settings are the hard ones', () => {
    assert.deepEqual(career.roundTiers(stats({ culture: 200 })), [1, 2, 3, 4, 5]);
    assert.equal(career.suggestionCount(stats({ memoire: 300 })), 4);
  });
});

describe('points by try', () => {
  test('a title found at the 6th try, possible on normal, is worth 15 points', () => {
    assert.equal(career.trackPoints(6), 15);
  });

  test('a title found at the 5th try still gives 25 points', () => {
    assert.equal(career.trackPoints(5), 25);
  });
});

describe('artistHint', () => {
  test('a solo gives its singer without the voice actor', () => {
    assert.deepEqual(career.artistHint('Ayumu Uehara (CV: Aguri Onishi)'), { group: 'Solo', singer: 'Ayumu Uehara' });
  });

  test('a unit or a group gives only its name', () => {
    assert.deepEqual(career.artistHint('A・ZU・NA'), { group: 'A・ZU・NA' });
    assert.deepEqual(career.artistHint('Nijigasaki High School Idol Club'), {
      group: 'Nijigasaki High School Idol Club',
    });
  });
});
