import type { CareerStat } from './types';

export interface StatStep {
  at: number;
  text: string;
}

// Display order and wording of the career stats. What each one unlocks is
// decided server-side (server/career.js); the steps below only describe it,
// so they must be updated together with the rules there.
export const CAREER_STATS: { stat: CareerStat; label: string; effect: string; steps: StatStep[] }[] = [
  {
    stat: 'oreille',
    label: 'Oreille',
    effect: 'Allonge les extraits',
    steps: [
      { at: 100, text: "+0,5 s à l'intro du 1er essai" },
      { at: 200, text: "+0,5 s à l'intro du 2e essai" },
      { at: 300, text: "+0,5 s à l'intro du 3e essai" },
    ],
  },
  {
    stat: 'memoire',
    label: 'Mémoire',
    effect: 'Plus de suggestions',
    steps: [
      { at: 100, text: '2 suggestions de recherche' },
      { at: 200, text: '3 suggestions de recherche' },
      { at: 300, text: '4 suggestions de recherche' },
    ],
  },
  {
    stat: 'culture',
    label: 'Culture',
    effect: 'Plus d’essais',
    steps: [
      { at: 100, text: 'un 4e essai (intro de 4 s)' },
      { at: 200, text: 'un 5e essai (intro de 5 s)' },
    ],
  },
];

export const STAT_STEP = 100;
