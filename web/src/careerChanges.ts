import { CAREER_STATS } from './careerStats';
import type { Career, CareerStat } from './types';

export interface CareerChanges {
  stats: Partial<Record<CareerStat, number>>;
  energy: number;
  fans: number;
}

// What a round brought, gains and losses alike; null when nothing moved.
export function computeChanges(before: Career, after: Career): CareerChanges | null {
  const stats: Partial<Record<CareerStat, number>> = {};
  for (const { stat } of CAREER_STATS) {
    const delta = after.stats[stat] - before.stats[stat];
    if (delta !== 0) stats[stat] = delta;
  }
  const energy = after.energy - before.energy;
  const fans = after.fans.current - before.fans.current;
  if (Object.keys(stats).length === 0 && energy === 0 && fans === 0) return null;
  return { stats, energy, fans };
}
