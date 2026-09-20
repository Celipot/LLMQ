import type { CareerStat } from './types';

// A stat unlocks the step n once it reaches n times the step size sent by the server.
// What the difficulty starts with: a step adds to it (a try after the last one, a suggestion
// after the ones already there).
export interface StatBase {
  baseTiers: number[];
  baseSuggestions: number;
}

export interface StatStep {
  step: number;
  text: (base: StatBase) => string;
}

// Display order and wording of the career stats. What each one unlocks is
// decided server-side (server/career.js); the steps below only describe it,
// so they must be updated together with the rules there.
export const CAREER_STATS: {
  stat: CareerStat;
  label: string;
  // The action that trains this stat.
  studyLabel: string;
  effect: string;
  steps: StatStep[];
}[] = [
  {
    stat: 'oreille',
    label: 'Chant',
    studyLabel: 'Chanter',
    effect: 'Allonge les extraits',
    steps: [
      { step: 1, text: () => "+0,5 s à l'intro du 1er essai" },
      { step: 2, text: () => "+0,5 s à l'intro du 2e essai" },
      { step: 3, text: () => "+0,5 s à l'intro du 3e essai" },
    ],
  },
  {
    stat: 'memoire',
    label: 'Connaissances',
    studyLabel: 'Étudier',
    effect: 'Plus de suggestions',
    steps: [
      { step: 1, text: ({ baseSuggestions }) => `${baseSuggestions + 1} suggestions de recherche` },
      { step: 2, text: ({ baseSuggestions }) => `${baseSuggestions + 2} suggestions de recherche` },
      { step: 3, text: ({ baseSuggestions }) => `${baseSuggestions + 3} suggestions de recherche` },
    ],
  },
  {
    stat: 'culture',
    label: 'Endurance',
    studyLabel: 'Musculation',
    effect: 'Plus d’essais',
    steps: [
      {
        step: 1,
        text: ({ baseTiers }) => `un ${baseTiers.length + 1}e essai (intro de ${baseTiers[baseTiers.length - 1] + 1} s)`,
      },
      {
        step: 2,
        text: ({ baseTiers }) => `un ${baseTiers.length + 2}e essai (intro de ${baseTiers[baseTiers.length - 1] + 2} s)`,
      },
    ],
  },
];
