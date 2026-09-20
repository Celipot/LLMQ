import { useState } from 'react';
import { CAREER_STATS, STAT_STEP } from '../careerStats';
import type { CareerStat } from '../types';

interface StatBarsProps {
  stats: Record<CareerStat, number>;
  statMax: Record<CareerStat, number>;
}

// The bar fills toward the next step of 100, where a stat unlocks its bonus.
// Past its maximum a stat keeps growing but its bar stays full; a negative one is empty.
// Hovering or focusing a stat lists every step and marks the ones reached.
export default function StatBars({ stats, statMax }: StatBarsProps) {
  const [openStat, setOpenStat] = useState<CareerStat | null>(null);

  return (
    <ul className="stat-bars">
      {CAREER_STATS.map(({ stat, label, effect, steps }) => {
        const tooltipId = `stat-tooltip-${stat}`;
        const open = openStat === stat;
        return (
          <li
            key={stat}
            className="stat-bar"
            tabIndex={0}
            aria-describedby={open ? tooltipId : undefined}
            onMouseEnter={() => setOpenStat(stat)}
            onMouseLeave={() => setOpenStat(null)}
            onFocus={() => setOpenStat(stat)}
            onBlur={() => setOpenStat(null)}
          >
            <div className="stat-bar-head">
              <span className="stat-bar-label">{label}</span>
              <span className="stat-bar-value">{stats[stat]}</span>
            </div>
            <div className="stat-bar-track" aria-hidden="true">
              <div
                className="stat-bar-fill"
                style={{
                  width: `${stats[stat] >= statMax[stat] ? 100 : Math.max(0, (stats[stat] % STAT_STEP) / STAT_STEP) * 100}%`,
                }}
              />
            </div>
            <span className="stat-bar-effect">{effect}</span>
            {open && (
              <div id={tooltipId} role="tooltip" className="stat-tooltip">
                <ul>
                  {steps.map(({ at, text }) => (
                    <li key={at} className={stats[stat] >= at ? 'reached' : undefined}>
                      {`${stats[stat] >= at ? '✓' : '·'} ${at} : ${text}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
