import { describe, expect, test } from 'vitest';
import { CAREER_UNITS } from './careerUnits';

describe('CAREER_UNITS', () => {
  test('lists the units in the order of the start screen, grouped by franchise, A・ZU・NA first', () => {
    expect(CAREER_UNITS).toEqual([
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
    ]);
  });
});
