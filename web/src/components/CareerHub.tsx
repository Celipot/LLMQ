import { CAREER_STATS } from '../careerStats';
import type { Career, CareerStat } from '../types';
import CareerObjective from './CareerObjective';
import CareerResult from './CareerResult';
import CareerScore from './CareerScore';
import StatBars from './StatBars';

// Only used to disable the button: the server refuses a single without enough energy.
const SINGLE_COST = 2;

interface CareerHubProps {
  career: Career | null;
  error: string | null;
  onBegin: () => void;
  onRest: () => void;
  onStudy: (stat: CareerStat) => void;
  onSingle: () => void;
  onRelease: () => void;
  onConcert: () => void;
}

export default function CareerHub({
  career,
  error,
  onBegin,
  onRest,
  onStudy,
  onSingle,
  onRelease,
  onConcert,
}: CareerHubProps) {
  if (!career) {
    return (
      <section className="career-hub">
        <p className="subtitle">
          Suivre la carrière d'Ayumu Uehara : étudier, sortir des singles, se reposer, sortir un album, puis donner un
          concert.
        </p>
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
  const over = career.failure !== null || career.concertResult !== null;

  return (
    <section className="career-hub career-layout">
      <aside className="career-column" aria-label="Statistiques">
        <div className="career-status">
          <span>{`Tour ${turn}`}</span>
          <span>{`Énergie ${career.energy} / ${career.maxEnergy}`}</span>
          <span>{`FSI ${career.fans.current}`}</span>
        </div>

        <StatBars stats={career.stats} />

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
      </aside>

      <div className="career-column">
        <CareerObjective career={career} />
        <img className="career-illustration" src="/career-placeholder.svg" alt="Illustration de la carrière" />

        <div className="career-column" role="group" aria-label="Actions">
          {over ? (
            <>
              {career.finalScore && <CareerScore score={career.finalScore} />}
              <div className="actions">
                <button type="button" onClick={onBegin}>
                  Nouvelle carrière
                </button>
              </div>
            </>
          ) : career.concertDue ? (
            <div className="actions">
              <button type="button" onClick={onConcert}>
                {career.concert.done > 0
                  ? `Poursuivre le concert (${career.concert.done} / ${career.concert.total})`
                  : 'Lancer le concert'}
              </button>
            </div>
          ) : career.releaseDue ? (
            <div className="actions">
              <button type="button" onClick={onRelease}>
                {career.album.done > 0
                  ? `Poursuivre l'album (${career.album.done} / ${career.album.total})`
                  : "Lancer la sortie de l'album"}
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
                <button
                  type="button"
                  title="Coûte 2 énergies : plus de stats sur une stat tirée au hasard, mais le titre n'entre pas dans le carnet"
                  disabled={career.energy < SINGLE_COST}
                  onClick={onSingle}
                >
                  Sortir un single
                </button>
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
        </div>
      </div>

      <aside className="career-column" aria-label="Récapitulatifs">
        {career.release && <CareerResult label="Album" result={career.release} />}
        {career.concertResult && <CareerResult label="Concert" result={career.concertResult} />}
      </aside>
    </section>
  );
}
