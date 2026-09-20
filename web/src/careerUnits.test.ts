import { describe, expect, test } from 'vitest';
import { CAREER_UNITS } from './careerUnits';

describe('CAREER_UNITS', () => {
  test('lists the units in the order of the start screen, A・ZU・NA first', () => {
    expect(CAREER_UNITS).toEqual([
      { unit: 'azuna', label: 'A・ZU・NA' },
      { unit: 'diverdiva', label: 'DiverDiva' },
      { unit: 'qu4rtz', label: 'QU4RTZ' },
      { unit: 'r3birth', label: 'R3BIRTH' },
    ]);
  });
});
