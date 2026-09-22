// Pure rules of the Mode Carrière (see us/carriere-v1.md and us/carriere-v2.md):
// stats, energy, turns and ranks. Isolated from Express and from song data, like gameState.js.

// Every franchise a career (classic or infinite) can follow. groupArtists lists every exact
// artist string of songs.json that stands for the whole group (Hasunosora has two, an older
// and a newer credit). songsGeneration is the `generation` field used to draw the infinite pool.
const GENERATIONS = {
  nijigasaki: { songsGeneration: 'Nijigasaki', groupArtists: ['Nijigasaki High School Idol Club'] },
  mus: { songsGeneration: "µ's", groupArtists: ["µ's"] },
  aqours: { songsGeneration: 'Aqours', groupArtists: ['Aqours'] },
  hasunosora: {
    songsGeneration: 'Hasunosora',
    groupArtists: ["Hasunosora Girls' High School Idol Club", 'Hasunosora High School Idol Club'],
  },
  liella: { songsGeneration: 'Liella', groupArtists: ['Liella!'] },
  ikizulive: { songsGeneration: 'Ikizulive', groupArtists: ["Ikizurai-Bu!"] },
};
const DEFAULT_GENERATION = 'nijigasaki';
// The infinite mode can also draw from every franchise at once, which no unit ever does.
const INFINITE_GENERATIONS = [...Object.keys(GENERATIONS), 'all'];

function isValidGeneration(generation) {
  return INFINITE_GENERATIONS.includes(generation);
}

// The data lists no members per unit: the pool of a unit is the solos of its members, its
// own titles and those of its franchise's group, all found by the exact artist string of
// songs.json. members always starts with the unit's own artist string.
const UNITS = {
  azuna: {
    generation: 'nijigasaki',
    members: [
      'A・ZU・NA',
      'Ayumu Uehara (CV: Aguri Onishi)',
      'Shizuku Osaka (CV: Kaori Maeda)',
      'Setsuna Yuki (CV: Tomori Kusunoki)',
      'Setsuna Yuki (CV: Coco Hayashi)',
    ],
  },
  diverdiva: {
    generation: 'nijigasaki',
    members: ['DiverDiva', 'Karin Asaka (CV: Miyu Kubota)', 'Ai Miyashita (CV: Natsumi Murakami)'],
  },
  qu4rtz: {
    generation: 'nijigasaki',
    members: [
      'QU4RTZ',
      'Kasumi Nakasu (CV: Mayu Sagara)',
      'Kanata Konoe (CV: Akari Kito)',
      'Emma Verde (CV: Maria Sashide)',
      'Rina Tennoji (CV: Chiemi Tanaka)',
    ],
  },
  r3birth: {
    generation: 'nijigasaki',
    members: [
      'R3BIRTH',
      'Shioriko Mifune (CV: Moeka Koizumi)',
      'Mia Taylor (CV: Shu Uchida)',
      'Lanzhu Zhong (CV: Akina Homoto)',
    ],
  },
  printemps: {
    generation: 'mus',
    members: ['Printemps', 'Honoka Kosaka (CV: Emi Nitta)', 'Kotori Minami (CV: Aya Uchida)', 'Umi Sonoda (CV: Suzuko Mimori)'],
  },
  lilywhite: {
    generation: 'mus',
    members: ['lily white', 'Rin Hoshizora (CV: Riho Iida)', 'Hanayo Koizumi (CV: Yurika Kubo)', 'Maki Nishikino (CV: Pile)'],
  },
  bibi: {
    generation: 'mus',
    members: ['BiBi', 'Nico Yazawa (CV: Sora Tokui)', 'Eli Ayase (CV: Yoshino Nanjo)', 'Nozomi Tojo (CV: Aina Kusuda)'],
  },
  cyaron: {
    generation: 'aqours',
    members: ['CYaRon!', 'Chika Takami (CV: Anju Inami)', 'You Watanabe (CV: Shuka Saito)', 'Ruby Kurosawa (CV: Ai Furihata)'],
  },
  azalea: {
    generation: 'aqours',
    members: ['AZALEA', 'Kanan Matsuura (CV: Nanaka Suwa)', 'Dia Kurosawa (CV: Arisa Komiya)', 'Mari Ohara (CV: Aina Suzuki)'],
  },
  guiltykiss: {
    generation: 'aqours',
    members: [
      'Guilty Kiss',
      'Riko Sakurauchi (CV: Rikako Aida)',
      'Yoshiko Tsushima (CV: Aika Kobayashi)',
      'Hanamaru Kunikida (CV: Kanako Takatsuki)',
    ],
  },
  cerisebouquet: {
    generation: 'hasunosora',
    members: ['Cerise Bouquet', 'Kaho Hinoshita (CV: Nozomi Nirei)', 'Kozue Otomune (CV: Nina Hanamiya)'],
  },
  dollchestra: {
    generation: 'hasunosora',
    members: ['DOLLCHESTRA', 'Sayaka Murano (CV: Kokona Nonaka)', 'Tsuzuri Yugiri (CV: Kotoko Sasaki)'],
  },
  miracrapark: {
    generation: 'hasunosora',
    members: ['Mira-Cra Park!', 'Rurino Osawa (CV: Kanna Kan)', 'Megumi Fujishima (CV: Kona Tsukine)'],
  },
  edelnote: { generation: 'hasunosora', members: ['Edel Note'] },
  catchu: {
    generation: 'liella',
    members: [
      'CatChu!',
      'Chisato Arashi (CV: Nako Misaki)',
      'Kinako Sakurakoji (CV: Nozomi Suzuhara)',
      'Shiki Wakana (CV: Wakana Ookuma)',
    ],
  },
  syncrise: {
    generation: 'liella',
    members: [
      '5yncri5e!',
      'Kanon Shibuya (CV: Sayuri Date)',
      'Keke Tang (CV: Liyuu)',
      'Sumire Heanna (CV: Naomi Payton)',
      'Ren Hazuki (CV: Nagisa Aoyama)',
    ],
  },
  kaleidoscore: {
    generation: 'liella',
    members: [
      'KALEIDOSCORE',
      'Wien Margarete (CV: Yuina)',
      'Mei Yoneme (CV: Akane Yabushima)',
      'Tomari Onitsuka (CV: Sakura Sakakura)',
      'Natsumi Onitsuka (CV: Aya Emori)',
    ],
  },
  ikizuraibu: {
    generation: 'ikizulive',
    members: [
      'Ikizurai-Bu!',
      'Akira Goto (CV: Seri Miyano)',
      'Aurora Konohana (CV: Akane Amasawa)',
      'Hanabi Komagata (CV: Kokoro Fujino)',
      'Mai Azabu (CV: Rina Endo)',
      'Midori Yamada (CV: Honoka Kotomori)',
      'Miracle Kanazawa (CV: Aiha Sakano)',
      'Noriko Chofu (CV: Ria Seko)',
      'Polka Takahashi (CV: Honon Ayasaki)',
      'Shion Sasaki (CV: Aoi Suzunose)',
      'Yukuri Harumiya (CV: Yuki Okumura)',
    ],
  },
};
const DEFAULT_UNIT = 'azuna';

function isValidUnit(unit) {
  return typeof unit === 'string' && Object.hasOwn(UNITS, unit);
}

const STATS = ['oreille', 'memoire', 'culture'];
const STAT_STEP = 100;
const HEARING_BONUS_SECONDS = 0.5;
// Hearing lengthens this many tiers, whatever the difficulty starts with.
const HEARING_STEPS = 3;
const MAX_EXTRA_TIERS = 2;
const MAX_EXTRA_SUGGESTIONS = 3;

// Two phases of 10 turns: the album is released after the first, the concert
// after the second. A third phase of 20 turns follows, ended by the finale. The
// infinite mode repeats that phase after each finale (see finalTurnOf).
const RELEASE_AFTER_TURN = 10;
const CONCERT_AFTER_TURN = 2 * RELEASE_AFTER_TURN;
const LOOP_TURNS = 20;
const FINAL_TURN = CONCERT_AFTER_TURN + LOOP_TURNS;
const MAX_ENERGY = 4;
const STUDY_COST = 1;
const SINGLE_COST = 2;

// Finding the title earlier teaches more; failing still teaches a little.
const STUDY_GAINS = { byStage: { 1: 40, 2: 30, 3: 25 }, late: 20, failed: 15 };
const SINGLE_GAINS = { byStage: { 1: 90, 2: 65, 3: 50 }, late: 45, failed: 30 };

// Fans are only won by releasing music: singles and the album. A minimum (which
// depends on the difficulty) is required to take part in the concert.
const SINGLE_FANS = { byStage: { 1: 40, 2: 30, 3: 25 }, late: 20, failed: 10 };
const ALBUM_FANS_DIVISOR = 2;
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'];

const ALBUM_SIZE = 6;
const CONCERT_SIZE = 15;
const FINALE_SIZE = 30;
// A 6th try only exists on normal, where a base of 4 tries plus endurance reaches it.
const TRACK_POINTS_BY_STAGE = { 1: 100, 2: 70, 3: 50, 4: 35, 5: 25, 6: 15 };
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
// What changes with the difficulty; everything else is shared. Each tier is the total
// clip length at that attempt, so a wrong guess or a skip always reveals more of the
// intro. The album must be graded at least albumGoalGrade or the career is failed, and
// so must requiredGood of the sorties of the third phase to take part in the finale.
const DIFFICULTIES = {
  hard: {
    fansRequired: 350,
    albumGoalGrade: 'B',
    finaleGoals: {
      concerts: { required: 2, requiredGood: 2 },
      albums: { required: 3, requiredGood: 2 },
    },
    negativeEvents: true,
    baseTiers: [1, 2, 3],
    baseSuggestions: 1,
    hint: false,
  },
  normal: {
    fansRequired: 200,
    albumGoalGrade: 'C',
    finaleGoals: {
      concerts: { required: 2, requiredGood: 1 },
      albums: { required: 3, requiredGood: 1 },
    },
    negativeEvents: false,
    baseTiers: [2, 3, 4, 5],
    baseSuggestions: 3,
    hint: true,
  },
};
const DEFAULT_DIFFICULTY = 'hard';

// The infinite mode plays the hard rules on the whole discography and loops on the
// third phase; a finale under this share of its maximum ends the run.
const MODES = ['classic', 'infinite'];
const LOOP_MIN_FINALE_PERCENT = 50;
// Each loop weakens the stat gains, down to a floor.
const LOOP_GAIN_LOSS = 0.15;
const MIN_GAIN_FACTOR = 0.2;
// Minimum total (best grade first) for the grade of a whole career, per mode.
const RUN_GRADES = {
  classic: [['S', 11000], ['A', 8500], ['B', 6000], ['C', 3500]],
  infinite: [['S', 40000], ['A', 25000], ['B', 12000], ['C', 6000]],
};

function isValidMode(mode) {
  return MODES.includes(mode);
}

function runGrade(total, mode) {
  const found = RUN_GRADES[mode].find(([, minimum]) => total >= minimum);
  return found ? found[0] : 'D';
}

function isValidDifficulty(difficulty) {
  return typeof difficulty === 'string' && Object.hasOwn(DIFFICULTIES, difficulty);
}

function settingsOf(state) {
  return DIFFICULTIES[state.difficulty];
}

// The maximum of a stat is its last bonus step; it can keep growing past it.
const STAT_MAX = {
  oreille: HEARING_STEPS * STAT_STEP,
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

function discographyIds(songs, unit) {
  const { generation, members } = UNITS[unit];
  const artists = new Set([...members, ...GENERATIONS[generation].groupArtists]);
  return songs.filter((song) => artists.has(song.artist)).map((song) => song.id);
}

function unlockedSteps(value) {
  return Math.floor(value / STAT_STEP);
}

// A negative stat removes a feature below the starting level: one tier only for
// culture, a shorter first tier for hearing. bonusSeconds lengthens every tier.
// The settings default to the hard ones, the rules the career always had.
function roundTiers(stats, bonusSeconds = 0, settings = DIFFICULTIES.hard) {
  const { baseTiers } = settings;
  const tiers = stats.culture < 0 ? [baseTiers[0]] : [...baseTiers];
  if (stats.oreille < 0) tiers[0] -= HEARING_BONUS_SECONDS;
  const hearingSteps = Math.min(unlockedSteps(stats.oreille), HEARING_STEPS, tiers.length);
  for (let i = 0; i < hearingSteps; i += 1) tiers[i] += HEARING_BONUS_SECONDS;
  const extraTiers = Math.min(unlockedSteps(stats.culture), MAX_EXTRA_TIERS);
  const lastBaseTier = baseTiers[baseTiers.length - 1];
  for (let i = 0; i < extraTiers; i += 1) tiers.push(lastBaseTier + i + 1);
  return tiers.map((seconds) => seconds + bonusSeconds);
}

function suggestionCount(stats, settings = DIFFICULTIES.hard) {
  if (stats.memoire < 0) return 0;
  return settings.baseSuggestions + Math.min(unlockedSteps(stats.memoire), MAX_EXTRA_SUGGESTIONS);
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

function albumGoalReached(state, grade) {
  return GRADE_ORDER.indexOf(grade) <= GRADE_ORDER.indexOf(settingsOf(state).albumGoalGrade);
}

function createCareer(difficulty = DEFAULT_DIFFICULTY, unit = DEFAULT_UNIT, mode = 'classic', generation = DEFAULT_GENERATION) {
  return {
    difficulty,
    unit,
    mode,
    generation,
    cycle: 1,
    username: null,
    submitted: false,
    turn: 1,
    energy: MAX_ENERGY,
    stats: { oreille: 0, memoire: 0, culture: 0 },
    notebook: [],
    album: [],
    concertTracks: [],
    sorties: [],
    pastSorties: [],
    finales: [],
    finale: null,
    loopEvents: [],
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

// Each cycle of the third phase ends with a finale, 20 turns after the previous one.
function finalTurnOf(state) {
  return FINAL_TURN + LOOP_TURNS * (state.cycle - 1);
}

// The infinite mode weakens the stat gains with each loop.
function statGainFactor(state) {
  if (state.mode !== 'infinite') return 1;
  return Math.max(MIN_GAIN_FACTOR, 1 - LOOP_GAIN_LOSS * (state.cycle - 1));
}

function scaledGain(state, gain) {
  return Math.round(gain * statGainFactor(state));
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
  return isPhase3(state) && !state.failure && !state.finale && state.turn > finalTurnOf(state);
}

function finaleGoalsOf(state) {
  return settingsOf(state).finaleGoals;
}

function finaleGoals(state) {
  const goals = {};
  Object.entries({ concerts: 'concert', albums: 'album' }).forEach(([name, kind]) => {
    const sorties = state.sorties.filter((sortie) => sortie.kind === kind);
    goals[name] = {
      done: sorties.length,
      good: sorties.filter((sortie) => albumGoalReached(state, sortie.grade)).length,
      ...finaleGoalsOf(state)[name],
    };
  });
  goals.met = Object.keys(finaleGoalsOf(state)).every(
    (name) => goals[name].done >= goals[name].required && goals[name].good >= goals[name].requiredGood,
  );
  return goals;
}

// Spending a turn ends the second phase on a failure when the fans needed for
// the concert were not won in time, and the third one when the goals of the
// finale were not reached.
function advanceTurn(state) {
  state.turn += 1;
  if (state.release && !state.concert && state.turn > CONCERT_AFTER_TURN && state.fans < settingsOf(state).fansRequired) {
    state.failure = 'FANS';
  }
  if (isPhase3(state) && state.turn > finalTurnOf(state) && !finaleGoals(state).met) state.failure = 'FINALE_GOALS';
}

function isOver(state) {
  return Boolean(state.failure || state.finale);
}

// What was played counts, so a career failed early still gets a (low) score.
function careerScore(state) {
  const album = state.release?.score ?? 0;
  const concert = state.concert?.score ?? 0;
  const sorties = [...state.pastSorties, ...state.sorties].reduce((total, sortie) => total + sortie.score, 0);
  const finale = state.finales.reduce((total, result) => total + result.score, 0);
  const stats = Object.values(state.stats).reduce((total, value) => total + value, 0);
  const total = album + concert + sorties + finale + stats + state.fans;
  return { album, concert, sorties, finale, stats, fans: state.fans, total, grade: runGrade(total, state.mode) };
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

// A found title joins the notebook; found again, it leaves it and goes back to the pool.
function toggleNotebook(state, songId) {
  const index = state.notebook.indexOf(songId);
  if (index === -1) state.notebook.push(songId);
  else state.notebook.splice(index, 1);
}

// foundAtStage is the 1-based tier the title was found at, null when the study
// round was lost. Nothing is mutated unless every check passes.
function study(state, stat, foundAtStage, songId) {
  assertCanStudy(state, stat);
  state.energy -= STUDY_COST;
  state.stats[stat] += scaledGain(state, studyGain(foundAtStage));
  if (foundAtStage !== null) toggleNotebook(state, songId);
  advanceTurn(state);
}

// A single trains harder than a study but its title never enters the notebook.
function single(state, stat, foundAtStage) {
  assertCanSingle(state, stat);
  state.energy -= SINGLE_COST;
  state.stats[stat] += scaledGain(state, singleGain(foundAtStage));
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
  if (!albumGoalReached(state, state.release.grade)) state.failure = 'ALBUM_GRADE';
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

// A classic finale ends the career. An infinite one starts the next cycle, unless
// it scored under the minimum share, which ends the run.
function finishFinale(state, result) {
  state.finales.push(result);
  if (state.mode === 'infinite' && result.score * 100 >= LOOP_MIN_FINALE_PERCENT * MAX_FINALE_SCORE) {
    state.pastSorties.push(...state.sorties);
    state.sorties = [];
    state.cycle += 1;
    return;
  }
  state.finale = result;
  if (state.mode === 'infinite') state.failure = 'FINALE_SCORE';
}

// The last track releases the sortie. An album and a concert use a turn, an
// album also wins fans; the finale ends the career.
function finishLiveTrack(state, foundAtStage, songId) {
  const { kind, tracks } = state.live;
  const { size, maxScore } = LIVES[kind];
  recordTrack(tracks, foundAtStage, songId);
  if (tracks.length < size) return;
  const result = summarize(tracks, maxScore, kind === 'finale' ? finalTurnOf(state) : state.turn);
  state.live = null;
  if (kind === 'finale') {
    finishFinale(state, result);
    return;
  }
  state.sorties.push({ kind, ...result });
  if (kind === 'album') state.fans += Math.floor(result.score / ALBUM_FANS_DIVISOR);
  advanceTurn(state);
}

function liveSongIds(state) {
  return state.live ? state.live.tracks.map((track) => track.songId) : [];
}

// The kind of title, from its artist: a solo gives its singer (without the voice actor),
// a unit or a group only its name, since the data does not list who sings them.
function artistHint(artist) {
  const solo = artist.match(/^(.*) \(CV: .*\)$/);
  return solo ? { group: 'Solo', singer: solo[1] } : { group: artist };
}

// A single trains a stat the player does not choose.
function pickStat(random = Math.random) {
  return STATS[Math.floor(random() * STATS.length)];
}

function pickSongId(pool, random = Math.random) {
  return pool[Math.floor(random() * pool.length)];
}

// Half of the tracks of an album, a concert or a finale (rounded up) come from the
// titles found while studying, the other half from the whole pool: the notebook only
// prepares the player, it does not make the sortie predictable. The source of each
// track is drawn with the odds of the quota still to fill, so the quota is met exactly
// wherever the notebook tracks land. A title never appears twice on the same sortie.
function pickPreparedSongId(pool, studiedIds, usedIds, total, random = Math.random) {
  const unused = pool.filter((id) => !usedIds.includes(id));
  const studied = unused.filter((id) => studiedIds.includes(id));
  const quotaLeft = Math.ceil(total / 2) - usedIds.filter((id) => studiedIds.includes(id)).length;
  const tracksLeft = total - usedIds.length;
  const fromNotebook = studied.length > 0 && random() < quotaLeft / tracksLeft;
  const source = fromNotebook ? studied : unused;
  return source[Math.floor(random() * source.length)];
}

module.exports = {
  UNITS,
  isValidUnit,
  GENERATIONS,
  DEFAULT_GENERATION,
  isValidGeneration,
  DIFFICULTIES,
  isValidDifficulty,
  settingsOf,
  artistHint,
  RELEASE_AFTER_TURN,
  CONCERT_AFTER_TURN,
  FINAL_TURN,
  LOOP_TURNS,
  finalTurnOf,
  statGainFactor,
  scaledGain,
  isValidMode,
  runGrade,
  MAX_ENERGY,
  STAT_MAX,
  STAT_STEP,
  STUDY_COST,
  SINGLE_COST,
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
