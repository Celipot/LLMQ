import type { CareerStat } from './types';

// Display order and wording of the career stats. What each one unlocks is
// decided server-side (server/career.js); the effect is only described here.
export const CAREER_STATS: { stat: CareerStat; label: string; effect: string }[] = [
  { stat: 'oreille', label: 'Oreille', effect: 'Allonge les extraits' },
  { stat: 'memoire', label: 'Mémoire', effect: 'Plus de suggestions' },
  { stat: 'culture', label: 'Culture', effect: 'Plus d’essais' },
];

export const STAT_STEP = 100;
