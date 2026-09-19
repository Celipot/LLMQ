// Weighted draw for the solo Random mode: songs the player struggles with, or
// has not heard for a while, come up more often. The history is supplied by the
// client on each draw (the server keeps no per-player state), so it is
// untrusted and goes through sanitizeHistory first.
const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_STAGE = 6;
const COOLDOWN_MS = 60 * 60 * 1000;
const FULL_RECENCY_DAYS = 14;
const WEIGHT_FLOOR = 0.1;
const DIFFICULTY_WEIGHT = 0.5;
const RECENCY_WEIGHT = 0.4;
// Pulls the difficulty of a song with few plays towards neutral (0.5): one
// easy win must not make a song look easy for good.
const PRIOR_PLAYS = 2;
const NEUTRAL_DIFFICULTY = 0.5;
const MAX_HISTORY_ENTRIES = 5000;
const MAX_PLAYS = 100000;

function difficulty(stat) {
  if (!stat || stat.plays === 0) return NEUTRAL_DIFFICULTY;
  const failureRate = 1 - stat.wins / stat.plays;
  const stageDifficulty = stat.wins > 0 ? (stat.stageSum / stat.wins - 1) / (MAX_STAGE - 1) : 1;
  const raw = 0.5 * failureRate + 0.5 * stageDifficulty;
  return (stat.plays * raw + PRIOR_PLAYS * NEUTRAL_DIFFICULTY) / (stat.plays + PRIOR_PLAYS);
}

function weight(stat, now) {
  if (!stat) return WEIGHT_FLOOR + DIFFICULTY_WEIGHT * NEUTRAL_DIFFICULTY + RECENCY_WEIGHT;
  const elapsed = now - stat.lastPlayedAt;
  if (elapsed < COOLDOWN_MS) return 0;
  const recency = Math.min(1, elapsed / DAY_MS / FULL_RECENCY_DAYS);
  return WEIGHT_FLOOR + DIFFICULTY_WEIGHT * difficulty(stat) + RECENCY_WEIGHT * recency;
}

function pickWeightedSongId(poolIds, history, now, rng = Math.random) {
  const weights = poolIds.map((id) => weight(history[id], now));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return poolIds[Math.floor(rng() * poolIds.length)];
  let threshold = rng() * total;
  for (let i = 0; i < poolIds.length; i += 1) {
    threshold -= weights[i];
    if (threshold < 0) return poolIds[i];
  }
  return poolIds[poolIds.length - 1];
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PLAYS;
}

function isValidStat(stat) {
  if (!stat || typeof stat !== 'object') return false;
  const { plays, wins, stageSum, lastPlayedAt } = stat;
  if (!isCount(plays) || !isCount(wins) || !isCount(stageSum)) return false;
  if (wins > plays || stageSum < wins || stageSum > wins * MAX_STAGE) return false;
  return Number.isFinite(lastPlayedAt) && lastPlayedAt >= 0;
}

// Returns null when the input is not a plain object (the route answers 400);
// individual bad entries are dropped instead so one corrupt song does not
// discard the whole history.
function sanitizeHistory(raw, isKnownSongId, now) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const clean = {};
  for (const key of Object.keys(raw).slice(0, MAX_HISTORY_ENTRIES)) {
    const id = Number(key);
    if (!Number.isInteger(id) || !isKnownSongId(id) || !isValidStat(raw[key])) continue;
    const { plays, wins, stageSum, lastPlayedAt } = raw[key];
    clean[id] = { plays, wins, stageSum, lastPlayedAt: Math.min(lastPlayedAt, now) };
  }
  return clean;
}

module.exports = { difficulty, weight, pickWeightedSongId, sanitizeHistory };
