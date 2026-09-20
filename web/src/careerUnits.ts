import type { Unit } from './types';

// The units of the career, in the order of the start screen. Which titles each one draws
// from is decided server-side (server/career.js); only the names live here, since the start
// screen shows them before any career exists.
export const CAREER_UNITS: { unit: Unit; label: string }[] = [
  { unit: 'azuna', label: 'A・ZU・NA' },
  { unit: 'diverdiva', label: 'DiverDiva' },
  { unit: 'qu4rtz', label: 'QU4RTZ' },
  { unit: 'r3birth', label: 'R3BIRTH' },
];
