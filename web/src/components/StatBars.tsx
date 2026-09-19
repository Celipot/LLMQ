import { CAREER_STATS, STAT_STEP } from '../careerStats';
import type { CareerStat } from '../types';

interface StatBarsProps {
  stats: Record<CareerStat, number>;
}

// The bar fills toward the next step of 100, where a stat unlocks its bonus.
export default function StatBars({ stats }: StatBarsProps) {
  return (
    <ul className="stat-bars">
      {CAREER_STATS.map(({ stat, label, effect }) => (
        <li key={stat} className="stat-bar">
          <div className="stat-bar-head">
            <span className="stat-bar-label">{label}</span>
            <span className="stat-bar-value">{stats[stat]}</span>
          </div>
          <div className="stat-bar-track" aria-hidden="true">
            <div className="stat-bar-fill" style={{ width: `${((stats[stat] % STAT_STEP) / STAT_STEP) * 100}%` }} />
          </div>
          <span className="stat-bar-effect">{effect}</span>
        </li>
      ))}
    </ul>
  );
}
