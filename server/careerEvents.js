// Events of the Mode Carrière (see us/carriere/carriere-v3.md): pure rules, like
// career.js. Timed events are scheduled when the career is created; the others
// fire when a stat reaches its maximum or the fans a threshold. Nothing here is
// drawn by probability: every event happens.

const career = require('./career');

const STAT_LABELS = { oreille: 'Oreille', memoire: 'Mémoire', culture: 'Culture' };

const SERIES_EVENT_ID = 10;
const SERIES_LENGTH = 5;
const SERIES_STAT_PER_EFFICIENCY = 15;
const SERIES_MAX_STAT_REWARD = 60;
const SERIES_MAX_EFFICIENCY = 4;

// window: the turn is drawn inside it at creation. statMax / fans: fire as soon
// as the stat reaches its maximum, or the fans the threshold.
const EVENTS = [
  { id: 1, window: [5, 10], effects: [{ type: 'energy', amount: 2 }], text: 'Énergie +2' },
  { id: 2, window: [15, 20], effects: [{ type: 'notebook', amount: 1 }], text: 'Carnet +1' },
  { id: 3, window: [21, 30], effects: [{ type: 'notebook', amount: -2 }], text: 'Carnet −2' },
  { id: 4, window: [31, 40], effects: [{ type: 'penalty', amount: 400, turns: 5 }] },
  { id: 5, window: [45, 50], effects: [{ type: 'notebook', amount: -5 }], text: 'Carnet −5' },
  { id: 6, statMax: 'oreille', effects: [{ type: 'stat', stat: 'culture', amount: 100 }], text: 'Culture +100' },
  { id: 7, statMax: 'memoire', effects: [{ type: 'stat', stat: 'oreille', amount: 100 }], text: 'Oreille +100' },
  { id: 8, statMax: 'culture', effects: [{ type: 'stat', stat: 'memoire', amount: 100 }], text: 'Mémoire +100' },
  { id: 9, fans: 500, effects: [{ type: 'notebook', amount: 3 }], text: 'Carnet +3' },
];

function scheduleEvents(state, random = Math.random) {
  EVENTS.filter((event) => event.window).forEach(({ id, window: [first, last] }) => {
    state.eventTurns[id] = first + Math.floor(random() * (last - first + 1));
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

function changeNotebook(state, amount, { pool, random }) {
  if (amount > 0) {
    const candidates = pool.filter((id) => !state.notebook.includes(id));
    for (let i = 0; i < amount && candidates.length > 0; i += 1) state.notebook.push(takeRandom(candidates, random));
    return;
  }
  for (let i = 0; i < -amount && state.notebook.length > 0; i += 1) takeRandom(state.notebook, random);
}

// Returns the text of the effect when it depends on a draw.
function applyEffect(state, effect, context) {
  if (effect.type === 'energy') {
    state.energy = Math.min(career.MAX_ENERGY, Math.max(0, state.energy + effect.amount));
  } else if (effect.type === 'stat') {
    state.stats[effect.stat] = Math.max(0, state.stats[effect.stat] + effect.amount);
  } else if (effect.type === 'notebook') {
    changeNotebook(state, effect.amount, context);
  } else if (effect.type === 'penalty') {
    const stat = career.pickStat(context.random);
    state.modifiers.push({ stat, delta: -effect.amount, expiresAtTurn: state.turn + effect.turns });
    return `${STAT_LABELS[stat]} −${effect.amount} pendant ${effect.turns} tours`;
  }
  return undefined;
}

function record(state, id, text) {
  state.events.push({ id, turn: state.turn, text });
  return { id, text };
}

// Applied at the end of an action, never in the middle of a round. Returns the
// events fired by this call, in order.
function applyDueEvents(state, context) {
  if (career.isOver(state)) return [];
  const fired = [];
  EVENTS.forEach((event) => {
    if (state.firedEvents.includes(event.id) || !isDue(state, event)) return;
    state.firedEvents.push(event.id);
    const texts = event.effects.map((effect) => applyEffect(state, effect, context));
    fired.push(record(state, event.id, texts.find(Boolean) ?? event.text));
  });
  return fired;
}

// Only studies and singles count; a failed one resets the series. A series of
// five offers a choice, sized by how quickly the titles were found.
function recordAnswer(state, foundAtStage) {
  if (foundAtStage === null) {
    state.streak = [];
    return;
  }
  state.streak.push(foundAtStage);
  if (state.streak.length < SERIES_LENGTH) return;
  const points = state.streak.reduce((total, stage) => total + career.trackPoints(stage), 0);
  const efficiency = Math.min(SERIES_MAX_EFFICIENCY, points / 100);
  state.streak = [];
  state.pendingChoice = {
    eventId: SERIES_EVENT_ID,
    options: {
      stats: { amount: Math.min(SERIES_MAX_STAT_REWARD, Math.round(SERIES_STAT_PER_EFFICIENCY * efficiency)) },
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

module.exports = {
  scheduleEvents,
  applyDueEvents,
  recordAnswer,
  chooseReward,
};
