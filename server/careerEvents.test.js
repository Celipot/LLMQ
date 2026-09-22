const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const career = require('./career');
const events = require('./careerEvents');

const POOL = Array.from({ length: 20 }, (_, i) => i + 1);

function scheduled(turns) {
  const state = career.createCareer();
  state.eventTurns = { 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 11: 99, ...turns };
  return state;
}

function apply(state, random = () => 0) {
  return events.applyDueEvents(state, { pool: POOL, random });
}

describe('scheduleEvents', () => {
  test('draws the turn of every timed event inside its window', () => {
    const first = career.createCareer();
    events.scheduleEvents(first, () => 0);
    assert.deepEqual(first.eventTurns, { 1: 5, 2: 15, 3: 21, 4: 26, 5: 35, 11: 30 });

    const last = career.createCareer();
    events.scheduleEvents(last, () => 0.999);
    assert.deepEqual(last.eventTurns, { 1: 10, 2: 20, 3: 28, 4: 34, 5: 40, 11: 40 });
  });
});

describe('a timed event', () => {
  test('does not happen before its turn', () => {
    const state = scheduled({ 1: 7 });
    state.turn = 6;
    assert.deepEqual(apply(state), []);
  });

  test('always happens once its turn is reached, and only once', () => {
    const state = scheduled({ 1: 7 });
    state.energy = 1;
    state.turn = 7;
    const fired = apply(state);
    assert.deepEqual(fired.map((event) => event.id), [1]);
    assert.equal(state.energy, 3);
    assert.deepEqual(apply(state), []);
    assert.equal(state.energy, 3);
  });

  test('keeps the energy under the maximum', () => {
    const state = scheduled({ 1: 7 });
    state.energy = 3;
    state.turn = 7;
    apply(state);
    assert.equal(state.energy, career.MAX_ENERGY);
  });

  test('is recorded in the history with its turn', () => {
    const state = scheduled({ 1: 7 });
    state.turn = 8;
    apply(state);
    assert.deepEqual(state.events, [{ id: 1, turn: 8, text: 'Énergie +2' }]);
  });

  test('several events on the same turn are all returned, in order', () => {
    const state = scheduled({ 1: 7, 2: 7 });
    state.turn = 7;
    assert.deepEqual(apply(state).map((event) => event.id), [1, 2]);
  });

  test('nothing happens once the career is over', () => {
    const state = scheduled({ 1: 7 });
    state.turn = 8;
    state.failure = 'FANS';
    assert.deepEqual(apply(state), []);
  });
});

describe('the notebook events', () => {
  test('event 2 adds a title that was not found yet', () => {
    const state = scheduled({ 2: 15 });
    state.turn = 15;
    state.notebook = POOL.slice(0, 19);
    apply(state);
    assert.deepEqual(state.notebook.slice(19), [20]);
  });

  test('event 3 removes two titles of the notebook', () => {
    const state = scheduled({ 3: 21 });
    state.turn = 21;
    state.notebook = [1, 2, 3];
    apply(state);
    assert.equal(state.notebook.length, 1);
    assert.ok([1, 2, 3].includes(state.notebook[0]));
  });

  test('event 5 empties a notebook that has fewer than 5 titles', () => {
    const state = scheduled({ 5: 45 });
    state.turn = 45;
    state.notebook = [1, 2];
    apply(state);
    assert.deepEqual(state.notebook, []);
  });
});

describe('event 4, the temporary penalty', () => {
  test('lowers a random stat by 400 for 5 turns', () => {
    const state = scheduled({ 4: 33 });
    state.turn = 33;
    const [fired] = apply(state, () => 0.5);
    assert.deepEqual(state.modifiers, [{ stat: 'memoire', delta: -400, expiresAtTurn: 38 }]);
    assert.match(fired.text, /400/);
  });

  test('the base stat is untouched', () => {
    const state = scheduled({ 4: 33 });
    state.turn = 33;
    state.stats.oreille = 50;
    apply(state, () => 0);
    assert.equal(state.stats.oreille, 50);
    assert.equal(career.effectiveStats(state).oreille, -100);
  });
});

describe('the stat maximum events', () => {
  test('hearing at its maximum gives 50 culture, culture gives memory, memory gives hearing', () => {
    [
      ['oreille', 300, 'culture', 6],
      ['culture', 200, 'memoire', 8],
      ['memoire', 300, 'oreille', 7],
    ].forEach(([stat, max, rewarded, id]) => {
      const state = scheduled({});
      state.stats[stat] = max;
      const fired = apply(state);
      assert.deepEqual(fired.map((event) => event.id), [id]);
      assert.equal(state.stats[rewarded], 50);
    });
  });

  test('a stat under its maximum triggers nothing', () => {
    const state = scheduled({});
    state.stats.oreille = 299;
    assert.deepEqual(apply(state), []);
  });

  test('happens only once even when the stat keeps growing', () => {
    const state = scheduled({});
    state.stats.oreille = 300;
    apply(state);
    state.stats.oreille = 340;
    assert.deepEqual(apply(state), []);
    assert.equal(state.stats.culture, 50);
  });

  test('judges the base stat, not a temporary penalty', () => {
    const state = scheduled({});
    state.stats.oreille = 300;
    state.modifiers = [{ stat: 'oreille', delta: -400, expiresAtTurn: 99 }];
    assert.deepEqual(apply(state).map((event) => event.id), [6]);
  });
});

describe('the fans event', () => {
  test('500 fans give 3 new titles, once', () => {
    const state = scheduled({});
    state.fans = 499;
    assert.deepEqual(apply(state), []);
    state.fans = 500;
    assert.deepEqual(apply(state).map((event) => event.id), [9]);
    assert.equal(state.notebook.length, 3);
    assert.deepEqual(apply(state), []);
  });
});

describe('the series event', () => {
  function answers(state, stages) {
    stages.forEach((stage) => events.recordAnswer(state, stage));
  }

  test('4 titles found in a row do not trigger it', () => {
    const state = career.createCareer();
    answers(state, [1, 1, 1, 1]);
    assert.equal(state.pendingChoice, null);
  });

  test('5 titles found in a row ask the player to choose', () => {
    const state = career.createCareer();
    answers(state, [1, 1, 1, 1, 1]);
    assert.equal(state.pendingChoice.eventId, 10);
    assert.deepEqual(state.pendingChoice.options, {
      stats: { amount: 30 },
      energy: { amount: 3 },
    });
    assert.deepEqual(state.streak, []);
  });

  test('the reward follows the efficiency, capped at 3', () => {
    const state = career.createCareer();
    answers(state, [3, 3, 3, 3, 3]);
    assert.deepEqual(state.pendingChoice.options, {
      stats: { amount: 25 },
      energy: { amount: 3 },
    });
  });

  test('it happens only once: a second series offers nothing', () => {
    const state = career.createCareer();
    answers(state, [1, 1, 1, 1, 1]);
    events.chooseReward(state, 'stats');
    answers(state, [1, 1, 1, 1, 1]);
    assert.equal(state.pendingChoice, null);
    assert.deepEqual(state.streak, []);
  });

  test('a failed answer resets the series', () => {
    const state = career.createCareer();
    answers(state, [1, 1, 1, 1, null, 1]);
    assert.equal(state.pendingChoice, null);
    assert.equal(state.streak.length, 1);
  });

  test('while a choice is pending no action is possible', () => {
    const state = career.createCareer();
    answers(state, [1, 1, 1, 1, 1]);
    assert.throws(() => career.rest(state), { message: 'EVENT_PENDING' });
    assert.throws(() => career.study(state, 'oreille', 1, 42), { message: 'EVENT_PENDING' });
  });

  test('choosing the stats gives the amount to each of the three', () => {
    const state = career.createCareer();
    answers(state, [1, 1, 1, 1, 1]);
    const fired = events.chooseReward(state, 'stats');
    assert.deepEqual(state.stats, { oreille: 30, memoire: 30, culture: 30 });
    assert.equal(state.pendingChoice, null);
    assert.equal(fired.id, 10);
    assert.equal(state.events.at(-1).id, 10);
  });

  test('choosing the energy fills the jauge up to its maximum', () => {
    const state = career.createCareer();
    state.energy = 1;
    answers(state, [3, 3, 3, 3, 3]);
    events.chooseReward(state, 'energy');
    assert.equal(state.energy, 4);
  });

  test('an unknown option is refused and the choice stays pending', () => {
    const state = career.createCareer();
    answers(state, [1, 1, 1, 1, 1]);
    assert.throws(() => events.chooseReward(state, 'fans'), { message: 'INVALID_CHOICE' });
    assert.notEqual(state.pendingChoice, null);
  });

  test('choosing without a pending choice is refused', () => {
    assert.throws(() => events.chooseReward(career.createCareer(), 'stats'), { message: 'NO_PENDING_CHOICE' });
  });
});

describe('the second penalty', () => {
  test('event 11 lowers a random stat by 400 for 5 turns, from turn 30 to 40', () => {
    const state = scheduled({ 11: 38 });
    state.turn = 38;
    const [fired] = apply(state, () => 0.999);
    assert.equal(fired.id, 11);
    assert.deepEqual(state.modifiers, [{ stat: 'culture', delta: -400, expiresAtTurn: 43 }]);
    assert.match(fired.text, /Endurance −400 pendant 5 tours/);
  });
});

describe('the titles won by an event', () => {
  test('a notebook gain lists the titles that were added', () => {
    const state = scheduled({ 2: 15 });
    state.turn = 15;
    state.notebook = POOL.slice(0, 19);
    const [fired] = apply(state);
    assert.deepEqual(fired.gained, [20]);
  });

  test('event 9 lists its three titles', () => {
    const state = scheduled({});
    state.fans = 500;
    const [fired] = apply(state);
    assert.equal(fired.gained.length, 3);
    assert.deepEqual(fired.gained, state.notebook);
  });

  test('an event without a notebook gain lists nothing', () => {
    const state = scheduled({ 1: 7 });
    state.turn = 7;
    assert.equal(apply(state)[0].gained, undefined);
    const lost = scheduled({ 3: 21 });
    lost.turn = 21;
    lost.notebook = [1, 2, 3];
    assert.equal(apply(lost)[0].gained, undefined);
  });
});

describe('the events of the finale', () => {
  function finale(tracksPlayed = 0) {
    const state = career.createCareer();
    state.live = {
      kind: 'finale',
      tracks: Array.from({ length: tracksPlayed }, (_, i) => ({ songId: i })),
      penalties: [],
      bonus: null,
    };
    return state;
  }

  test('schedules three penalties and one bonus between the 2nd and the 25th track', () => {
    const state = finale();
    events.scheduleFinaleEvents(state.live, () => 0);
    assert.deepEqual(state.live.schedule, { 12: 2, 13: 2, 14: 2, 15: 2 });
    events.scheduleFinaleEvents(state.live, () => 0.999);
    assert.deepEqual(state.live.schedule, { 12: 25, 13: 25, 14: 25, 15: 25 });
  });

  test('nothing happens before the scheduled track', () => {
    const state = finale(0);
    state.live.schedule = { 12: 2, 13: 5, 14: 8, 15: 11 };
    assert.deepEqual(events.applyFinaleEvents(state, { random: () => 0 }), []);
  });

  test('a penalty lowers a stat by 500 for 3 tracks, the one it fires on included', () => {
    const state = finale(1);
    state.stats.oreille = 300;
    state.live.schedule = { 12: 2 };
    const [fired] = events.applyFinaleEvents(state, { random: () => 0 });
    assert.equal(fired.id, 12);
    assert.deepEqual(state.live.penalties, [{ stat: 'oreille', delta: -500, untilTrack: 4 }]);
    assert.equal(fired.text, 'Chant −500 pendant 3 titres');
    assert.equal(career.effectiveStats(state).oreille, -100);
  });

  test('a penalty never targets a stat that is already negative', () => {
    const state = finale(1);
    state.modifiers = [{ stat: 'oreille', delta: -400, expiresAtTurn: 99 }];
    state.live.schedule = { 12: 2 };
    events.applyFinaleEvents(state, { random: () => 0 });
    assert.equal(state.live.penalties[0].stat, 'memoire');
  });

  test('a penalty is skipped when every stat is already negative', () => {
    const state = finale(1);
    state.live.penalties = ['oreille', 'memoire', 'culture'].map((stat) => ({ stat, delta: -500, untilTrack: 9 }));
    state.live.schedule = { 12: 2 };
    assert.deepEqual(events.applyFinaleEvents(state, { random: () => 0 }), []);
    assert.equal(state.live.penalties.length, 3);
  });

  test('the bonus adds 15 seconds to every tier for 3 tracks', () => {
    const state = finale(1);
    state.live.schedule = { 15: 2 };
    const [fired] = events.applyFinaleEvents(state, { random: () => 0 });
    assert.equal(fired.id, 15);
    assert.equal(fired.text, 'Intro +15 s à chaque essai pendant 3 titres');
    assert.deepEqual(state.live.bonus, { seconds: 15, untilTrack: 4 });
    assert.equal(career.roundBonusSeconds(state), 15);
  });

  test('an event fires only once', () => {
    const state = finale(1);
    state.live.schedule = { 15: 2 };
    events.applyFinaleEvents(state, { random: () => 0 });
    assert.deepEqual(events.applyFinaleEvents(state, { random: () => 0 }), []);
  });

  test('the events are recorded in the history', () => {
    const state = finale(1);
    state.live.schedule = { 15: 2 };
    events.applyFinaleEvents(state, { random: () => 0 });
    assert.equal(state.events.at(-1).id, 15);
  });
});

describe('the events of an infinite cycle', () => {
  function infinite(cycle) {
    const state = career.createCareer('hard', 'azuna', 'infinite');
    state.cycle = cycle;
    return state;
  }

  test('the second cycle draws two events in its 20 turns: a penalty, then a notebook loss', () => {
    const state = infinite(2);
    events.scheduleLoopEvents(state, () => 0);
    assert.deepEqual(state.loopEvents, [
      { id: 4, type: 'penalty', turn: 41, amount: 500, turns: 6 },
      { id: 3, type: 'notebook', turn: 41, amount: -3 },
    ]);
    events.scheduleLoopEvents(state, () => 0.999);
    assert.deepEqual(state.loopEvents.map((event) => event.turn), [60, 60]);
  });

  test('the events grow more frequent, longer and heavier with the cycle', () => {
    const state = infinite(4);
    events.scheduleLoopEvents(state, () => 0);
    assert.deepEqual(state.loopEvents.map((event) => [event.type, event.turn, event.amount, event.turns]), [
      ['penalty', 81, 700, 8],
      ['notebook', 81, -5, undefined],
      ['penalty', 81, 700, 8],
      ['notebook', 81, -5, undefined],
    ]);
  });

  test('a loop event fires once, when its turn comes', () => {
    const state = infinite(2);
    state.loopEvents = [{ id: 4, type: 'penalty', turn: 45, amount: 500, turns: 6 }];
    state.turn = 44;
    assert.deepEqual(apply(state), []);
    state.turn = 45;
    const [fired] = apply(state);
    assert.equal(fired.id, 4);
    assert.match(fired.text, /Chant −500 pendant 6 tours/);
    assert.deepEqual(state.modifiers, [{ stat: 'oreille', delta: -500, expiresAtTurn: 51 }]);
    assert.deepEqual(apply(state), []);
  });

  test('a loop notebook event takes titles out of the notebook', () => {
    const state = infinite(2);
    state.notebook = [1, 2, 3, 4, 5];
    state.loopEvents = [{ id: 3, type: 'notebook', turn: 41, amount: -3 }];
    state.turn = 41;
    const [fired] = apply(state);
    assert.equal(fired.text, 'Carnet −3');
    assert.equal(state.notebook.length, 2);
  });

  test('the penalties of the finale weigh 100 more and last one more track per cycle', () => {
    const state = infinite(3);
    state.stats.oreille = 300;
    state.live = { kind: 'finale', tracks: [{ songId: 1 }], penalties: [], bonus: null, schedule: { 12: 2 } };
    const [fired] = events.applyFinaleEvents(state, { random: () => 0 });
    assert.deepEqual(state.live.penalties, [{ stat: 'oreille', delta: -700, untilTrack: 6 }]);
    assert.equal(fired.text, 'Chant −700 pendant 5 titres');
  });

  test('the reward of the series weakens with the cycle', () => {
    const state = infinite(2);
    [1, 1, 1, 1, 1].forEach((stage) => events.recordAnswer(state, stage));
    assert.deepEqual(state.pendingChoice.options.stats, { amount: 26 });
  });
});

describe('the events of the normal difficulty', () => {
  function normalScheduled(turns) {
    const state = career.createCareer('normal');
    state.eventTurns = { 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 11: 99, ...turns };
    return state;
  }

  test('the negative events of the turns never happen', () => {
    const state = normalScheduled({ 3: 21, 4: 26, 5: 35, 11: 30 });
    state.notebook = [1, 2, 3, 4, 5, 6];
    state.turn = 40;

    assert.deepEqual(apply(state), []);
    assert.deepEqual(state.notebook, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(state.modifiers, []);
  });

  test('the positive events still happen', () => {
    const state = normalScheduled({ 1: 7, 2: 15 });
    state.energy = 1;
    state.turn = 15;

    assert.deepEqual(apply(state).map((event) => event.id), [1, 2]);
    assert.equal(state.energy, 3);
  });

  test('the same negative events do happen on hard', () => {
    const state = scheduled({ 3: 21, 5: 35 });
    state.notebook = [1, 2, 3, 4, 5, 6, 7];
    state.turn = 40;

    assert.deepEqual(apply(state).map((event) => event.id), [3, 5]);
  });

  function normalFinale(tracksPlayed) {
    const state = career.createCareer('normal');
    state.live = {
      kind: 'finale',
      tracks: Array.from({ length: tracksPlayed }, (_, i) => ({ songId: i })),
      penalties: [],
      bonus: null,
    };
    state.stats.oreille = 300;
    return state;
  }

  test('the penalties of the finale never happen', () => {
    const state = normalFinale(1);
    state.live.schedule = { 12: 2, 13: 2, 14: 2 };

    assert.deepEqual(events.applyFinaleEvents(state, { random: () => 0 }), []);
    assert.deepEqual(state.live.penalties, []);
  });

  test('the time bonus of the finale still happens', () => {
    const state = normalFinale(1);
    state.live.schedule = { 15: 2 };

    const [fired] = events.applyFinaleEvents(state, { random: () => 0 });

    assert.equal(fired.id, 15);
    assert.deepEqual(state.live.bonus, { seconds: 15, untilTrack: 4 });
  });
});
