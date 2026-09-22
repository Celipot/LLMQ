import type { Generation, Unit } from './types';

// The units of the career, in the order of the start screen, grouped by franchise. Which
// titles each one draws from is decided server-side (server/career.js); only the names and
// their franchise live here, since the start screen shows them before any career exists.
export const CAREER_UNITS: { unit: Unit; label: string; generation: Generation }[] = [
  { unit: 'azuna', label: 'A・ZU・NA', generation: 'nijigasaki' },
  { unit: 'diverdiva', label: 'DiverDiva', generation: 'nijigasaki' },
  { unit: 'qu4rtz', label: 'QU4RTZ', generation: 'nijigasaki' },
  { unit: 'r3birth', label: 'R3BIRTH', generation: 'nijigasaki' },
  { unit: 'printemps', label: 'Printemps', generation: 'mus' },
  { unit: 'lilywhite', label: 'lily white', generation: 'mus' },
  { unit: 'bibi', label: 'BiBi', generation: 'mus' },
  { unit: 'cyaron', label: 'CYaRon!', generation: 'aqours' },
  { unit: 'azalea', label: 'AZALEA', generation: 'aqours' },
  { unit: 'guiltykiss', label: 'Guilty Kiss', generation: 'aqours' },
  { unit: 'cerisebouquet', label: 'Cerise Bouquet', generation: 'hasunosora' },
  { unit: 'dollchestra', label: 'DOLLCHESTRA', generation: 'hasunosora' },
  { unit: 'miracrapark', label: 'Mira-Cra Park!', generation: 'hasunosora' },
  { unit: 'edelnote', label: 'Edel Note', generation: 'hasunosora' },
  { unit: 'catchu', label: 'CatChu!', generation: 'liella' },
  { unit: 'syncrise', label: '5yncri5e!', generation: 'liella' },
  { unit: 'kaleidoscore', label: 'KALEIDOSCORE', generation: 'liella' },
  { unit: 'ikizuraibu', label: 'Ikizurai-Bu!', generation: 'ikizulive' },
];
