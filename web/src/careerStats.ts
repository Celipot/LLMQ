import type { CareerStat } from './types';

// A stat unlocks the step n once it reaches n times the step size sent by the server.
export interface StatStep {
  step: number;
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
      { step: 1, text: "+0,5 s à l'intro du 1er essai" },
      { step: 2, text: "+0,5 s à l'intro du 2e essai" },
      { step: 3, text: "+0,5 s à l'intro du 3e essai" },
    ],
  },
  {
    stat: 'memoire',
    label: 'Mémoire',
    effect: 'Plus de suggestions',
    steps: [
      { step: 1, text: '2 suggestions de recherche' },
      { step: 2, text: '3 suggestions de recherche' },
      { step: 3, text: '4 suggestions de recherche' },
    ],
  },
  {
    stat: 'culture',
    label: 'Culture',
    effect: 'Plus d’essais',
    steps: [
      { step: 1, text: 'un 4e essai (intro de 4 s)' },
      { step: 2, text: 'un 5e essai (intro de 5 s)' },
    ],
  },
];
