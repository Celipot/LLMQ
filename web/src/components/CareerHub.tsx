import { CAREER_STATS } from '../careerStats';
import type { Career, CareerStat } from '../types';
import StatBars from './StatBars';

interface CareerHubProps {
  career: Career | null;
  error: string | null;
  onBegin: () => void;
  onRest: () => void;
  onStudy: (stat: CareerStat) => void;
  onRelease: () => void;
}

export default function CareerHub({ career, error, onBegin, onRest, onStudy, onRelease }: CareerHubProps) {
  if (!career) {
    return (
      <section className="career-hub">
        <p className="subtitle">Suivre la carrière d'Ayumu Uehara : étudier, se reposer, puis sortir un album.</p>
        <button type="button" onClick={onBegin}>
          Commencer une carrière
        </button>
        {error && (
          <p className="error-msg" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  const turn = Math.min(career.turn, career.totalTurns);

  return (
    <section className="career-hub">
      <div className="career-status">
        <span>{`Tour ${turn} / ${career.totalTurns}`}</span>
        <span>{`Énergie ${career.energy} / ${career.maxEnergy}`}</span>
      </div>

      <StatBars stats={career.stats} />

      {career.release ? (
        <div className="career-release">
          <p className="career-rank">{career.release.rank === 'FAIL' ? 'Sortie ratée' : `Rang ${career.release.rank}`}</p>
          <img className="career-cover" src={career.release.song.coverUrl} alt="" />
          <p>{career.release.song.title}</p>
          <button type="button" onClick={onBegin}>
            Nouvelle carrière
          </button>
        </div>
      ) : career.releaseDue ? (
        <div className="actions">
          <button type="button" onClick={onRelease}>
            Lancer la sortie de l'album
          </button>
        </div>
      ) : (
        <>
          <div className="actions">
            {CAREER_STATS.map(({ stat, label }) => (
              <button key={stat} type="button" disabled={career.energy === 0} onClick={() => onStudy(stat)}>
                {`Étudier : ${label}`}
              </button>
            ))}
          </div>
          <div className="actions">
            <button type="button" className="secondary" onClick={onRest}>
              Se reposer
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="error-msg" role="alert">
          {error}
        </p>
      )}

      {career.notebook.length > 0 && (
        <div className="career-notebook">
          <h2>{`Carnet (${career.notebook.length})`}</h2>
          <ul>
            {career.notebook.map((song) => (
              <li key={song.id}>{song.title}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
