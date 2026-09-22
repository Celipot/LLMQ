// Events of the Mode Carrière (see us/carriere/carriere-v3.md): pure rules, like
// career.js. Timed events are scheduled when the career is created; the others
// fire when a stat reaches its maximum or the fans a threshold. Nothing here is
// drawn by probability: every event happens.

const career = require('./career');

const STAT_LABELS = { oreille: 'Chant', memoire: 'Connaissances', culture: 'Endurance' };

const SERIES_EVENT_ID = 10;
const SERIES_LENGTH = 5;
const SERIES_STAT_PER_EFFICIENCY = 10;
const SERIES_MAX_STAT_REWARD = 40;
const SERIES_MAX_EFFICIENCY = 3;

// window: the turn is drawn inside it at creation. statMax / fans: fire as soon
// as the stat reaches its maximum, or the fans the threshold. negative: never
// happens on a difficulty without negative events.
const EVENTS = [
  { id: 1, window: [5, 10], effects: [{ type: 'energy', amount: 2 }], text: 'Énergie +2' },
  { id: 2, window: [15, 20], effects: [{ type: 'notebook', amount: 1 }], text: 'Carnet +1' },
  { id: 3, window: [21, 28], negative: true, effects: [{ type: 'notebook', amount: -2 }], text: 'Carnet −2' },
  { id: 4, window: [26, 34], negative: true, effects: [{ type: 'penalty', amount: 400, turns: 5 }] },
  { id: 5, window: [35, 40], negative: true, effects: [{ type: 'notebook', amount: -5 }], text: 'Carnet −5' },
  { id: 6, statMax: 'oreille', effects: [{ type: 'stat', stat: 'culture', amount: 50 }], text: 'Endurance +50' },
  { id: 7, statMax: 'memoire', effects: [{ type: 'stat', stat: 'oreille', amount: 50 }], text: 'Chant +50' },
  { id: 8, statMax: 'culture', effects: [{ type: 'stat', stat: 'memoire', amount: 50 }], text: 'Connaissances +50' },
  { id: 9, fans: 500, effects: [{ type: 'notebook', amount: 3 }], text: 'Carnet +3' },
  { id: 11, window: [30, 40], negative: true, effects: [{ type: 'penalty', amount: 400, turns: 5 }] },
];

// During the finale, events fire on a track (not a turn): three penalties and a
// bonus, each lasting a few tracks, the one they fire on included.
const FINALE_TRACKS = [2, 25];
const FINALE_EVENT_TRACKS = 3;
const FINALE_PENALTY = 500;
// Each loop of the infinite mode makes the penalties of the finale heavier and longer.
const LOOP_FINALE_PENALTY_STEP = 100;
const FINALE_BONUS_SECONDS = 15;
const FINALE_EVENTS = [
  { id: 12, type: 'penalty' },
  { id: 13, type: 'penalty' },
  { id: 14, type: 'penalty' },
  { id: 15, type: 'bonus' },
];

// Each loop of the infinite mode draws 1 + n negative events in its 20 turns, n being
// the number of finales already played: a penalty, then a notebook loss, and so on,
// each one longer and heavier than in the previous loop.
const LOOP_PENALTY_ID = 4;
const LOOP_NOTEBOOK_ID = 3;
const LOOP_PENALTY_AMOUNT = 400;
const LOOP_PENALTY_STEP = 100;
const LOOP_PENALTY_TURNS = 5;
const LOOP_NOTEBOOK_LOSS = 2;

function scheduleEvents(state, random = Math.random) {
  EVENTS.filter((event) => event.window).forEach(({ id, window: [first, last] }) => {
    state.eventTurns[id] = first + Math.floor(random() * (last - first + 1));
  });
}

function scheduleLoopEvents(state, random = Math.random) {
  const loops = state.cycle - 1;
  const first = career.finalTurnOf({ cycle: loops }) + 1;
  const last = career.finalTurnOf(state);
  state.loopEvents = Array.from({ length: 1 + loops }, (_, index) => {
    const turn = first + Math.floor(random() * (last - first + 1));
    if (index % 2 === 0) {
      return {
        id: LOOP_PENALTY_ID,
        type: 'penalty',
        turn,
        amount: LOOP_PENALTY_AMOUNT + LOOP_PENALTY_STEP * loops,
        turns: LOOP_PENALTY_TURNS + loops,
      };
    }
    return { id: LOOP_NOTEBOOK_ID, type: 'notebook', turn, amount: -(LOOP_NOTEBOOK_LOSS + loops) };
  });
}

function isDue(state, event) {
  if (event.window) return state.turn >= state.eventTurns[event.id];
  if (event.statMax) return state.stats[event.statMax] >= career.STAT_MAX[event.statMax];
  return state.fans >= event.fans;
}

function takeRandom(list, random) {
  return list.splice(Math.floor(random() * list.length), 1)[0];
}

// Returns the titles added to the notebook.
function changeNotebook(state, amount, { pool, random }) {
  const gained = [];
  if (amount > 0) {
    const candidates = pool.filter((id) => !state.notebook.includes(id));
    for (let i = 0; i < amount && candidates.length > 0; i += 1) gained.push(takeRandom(candidates, random));
    state.notebook.push(...gained);
    return gained;
  }
  for (let i = 0; i < -amount && state.notebook.length > 0; i += 1) takeRandom(state.notebook, random);
  return gained;
}

// Returns what the player must be told when it depends on a draw: the text of a
// penalty, the titles won by a notebook gain.
function applyEffect(state, effect, context) {
  if (effect.type === 'energy') {
    state.energy = Math.min(career.MAX_ENERGY, Math.max(0, state.energy + effect.amount));
  } else if (effect.type === 'stat') {
    state.stats[effect.stat] = Math.max(0, state.stats[effect.stat] + effect.amount);
  } else if (effect.type === 'notebook') {
    return { gained: changeNotebook(state, effect.amount, context) };
  } else if (effect.type === 'penalty') {
    const stat = career.pickStat(context.random);
    state.modifiers.push({ stat, delta: -effect.amount, expiresAtTurn: state.turn + effect.turns });
    return { text: `${STAT_LABELS[stat]} −${effect.amount} pendant ${effect.turns} tours` };
  }
  return {};
}

// The history keeps the text; the titles won are only reported to the player once.
function record(state, id, text, gained = []) {
  state.events.push({ id, turn: state.turn, text });
  return gained.length > 0 ? { id, text, gained } : { id, text };
}

// Applied at the end of an action, never in the middle of a round. Returns the
// events fired by this call, in order.
function applyDueEvents(state, context) {
  if (career.isOver(state)) return [];
  const { negativeEvents } = career.settingsOf(state);
  const fired = [];
  EVENTS.forEach((event) => {
    if (event.negative && !negativeEvents) return;
    if (state.firedEvents.includes(event.id) || !isDue(state, event)) return;
    state.firedEvents.push(event.id);
    const results = event.effects.map((effect) => applyEffect(state, effect, context));
    const text = results.find((result) => result.text)?.text ?? event.text;
    fired.push(record(state, event.id, text, results.flatMap((result) => result.gained ?? [])));
  });
  fired.push(...applyDueLoopEvents(state, context));
  return fired;
}

function applyDueLoopEvents(state, context) {
  const due = state.loopEvents.filter((event) => state.turn >= event.turn);
  state.loopEvents = state.loopEvents.filter((event) => !due.includes(event));
  return due.map(({ id, type, amount, turns }) => {
    const { text, gained } = applyEffect(state, { type, amount, turns }, context);
    return record(state, id, text ?? `Carnet −${-amount}`, gained);
  });
}

// Only studies and singles count; a failed one resets the series. A series of
// five offers a choice, sized by how quickly the titles were found; it happens
// once per career.
function recordAnswer(state, foundAtStage) {
  if (state.firedEvents.includes(SERIES_EVENT_ID)) return;
  if (foundAtStage === null) {
    state.streak = [];
    return;
  }
  state.streak.push(foundAtStage);
  if (state.streak.length < SERIES_LENGTH) return;
  const points = state.streak.reduce((total, stage) => total + career.trackPoints(stage), 0);
  const efficiency = Math.min(SERIES_MAX_EFFICIENCY, points / 100);
  const statReward = Math.min(SERIES_MAX_STAT_REWARD, Math.round(SERIES_STAT_PER_EFFICIENCY * efficiency));
  state.streak = [];
  state.firedEvents.push(SERIES_EVENT_ID);
  state.pendingChoice = {
    eventId: SERIES_EVENT_ID,
    options: {
      stats: { amount: career.scaledGain(state, statReward) },
      energy: { amount: Math.min(career.MAX_ENERGY, Math.round(efficiency)) },
    },
  };
}

function chooseReward(state, option) {
  if (!state.pendingChoice) throw new Error('NO_PENDING_CHOICE');
  const { eventId, options } = state.pendingChoice;
  if (!Object.hasOwn(options, option)) throw new Error('INVALID_CHOICE');
  const { amount } = options[option];
  if (option === 'stats') {
    Object.keys(state.stats).forEach((stat) => applyEffect(state, { type: 'stat', stat, amount }));
  } else {
    applyEffect(state, { type: 'energy', amount });
  }
  state.pendingChoice = null;
  return record(state, eventId, option === 'stats' ? `Série ! Toutes les stats +${amount}` : `Série ! Énergie +${amount}`);
}

// Drawn when the finale starts: each event fires on its own track.
function scheduleFinaleEvents(live, random = Math.random) {
  const [first, last] = FINALE_TRACKS;
  live.schedule = {};
  FINALE_EVENTS.forEach(({ id }) => {
    live.schedule[id] = first + Math.floor(random() * (last - first + 1));
  });
}

// Called before each track of the finale starts. A penalty never targets a stat
// that is already negative, and is skipped when there is none left.
function applyFinaleEvents(state, { random }) {
  const { live } = state;
  const track = career.liveTrackNumber(state);
  const fired = live.fired ?? (live.fired = []);
  const loops = state.mode === 'infinite' ? state.cycle - 1 : 0;
  const penalty = FINALE_PENALTY + LOOP_FINALE_PENALTY_STEP * loops;
  const penaltyTracks = FINALE_EVENT_TRACKS + loops;
  const news = [];
  const { negativeEvents } = career.settingsOf(state);
  FINALE_EVENTS.forEach(({ id, type }) => {
    if (type === 'penalty' && !negativeEvents) return;
    if (live.schedule[id] !== track || fired.includes(id)) return;
    fired.push(id);
    if (type === 'bonus') {
      live.bonus = { seconds: FINALE_BONUS_SECONDS, untilTrack: track + FINALE_EVENT_TRACKS - 1 };
      news.push(record(state, id, `Intro +${FINALE_BONUS_SECONDS} s à chaque essai pendant ${FINALE_EVENT_TRACKS} titres`));
      return;
    }
    const effective = career.effectiveStats(state);
    const candidates = Object.keys(effective).filter((stat) => effective[stat] >= 0);
    if (candidates.length === 0) return;
    const stat = candidates[Math.floor(random() * candidates.length)];
    live.penalties.push({ stat, delta: -penalty, untilTrack: track + penaltyTracks - 1 });
    news.push(record(state, id, `${STAT_LABELS[stat]} −${penalty} pendant ${penaltyTracks} titres`));
  });
  return news;
}

module.exports = {
  scheduleEvents,
  scheduleLoopEvents,
  scheduleFinaleEvents,
  applyFinaleEvents,
  applyDueEvents,
  recordAnswer,
  chooseReward,
};
