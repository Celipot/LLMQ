import { describe, expect, test } from 'vitest';
import { computeChanges } from './careerChanges';
import type { Career } from './types';

const before = {
  energy: 4,
  stats: { oreille: 100, memoire: 50, culture: 0 },
  fans: { current: 40, required: 450 },
} as Career;

describe('computeChanges', () => {
  test('lists the gains of the stats, the energy and the fans', () => {
    const after = { ...before, energy: 6, stats: { ...before.stats, oreille: 150 }, fans: { ...before.fans, current: 80 } } as Career;

    expect(computeChanges(before, after)).toEqual({ stats: { oreille: 50 }, energy: 2, fans: 40 });
  });

  test('lists the losses as negative changes', () => {
    const after = { ...before, energy: 2, stats: { ...before.stats, culture: -500 } } as Career;

    expect(computeChanges(before, after)).toEqual({ stats: { culture: -500 }, energy: -2, fans: 0 });
  });

  test('is null when nothing moved', () => {
    expect(computeChanges(before, { ...before })).toBeNull();
  });
});
