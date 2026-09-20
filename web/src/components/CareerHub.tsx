import type { CareerChanges } from '../careerChanges';
import { CAREER_STATS } from '../careerStats';
import type { Career, CareerEvent as CareerEventData, CareerStat, RewardOption } from '../types';
import CareerEvent from './CareerEvent';
import CareerNotebook from './CareerNotebook';
import CareerObjective from './CareerObjective';
import CareerResult from './CareerResult';
import CareerScore from './CareerScore';
import ChangeBadge from './ChangeBadge';
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
  onFinale: () => void;
  // Events fired by the last action, still to be acknowledged.
  events: CareerEventData[];
  onDismissEvent: () => void;
  onChooseReward: (option: RewardOption) => void;
  // What the last round brought, highlighted for a few seconds.
  changes?: CareerChanges | null;
}

const LIVE_LABELS = { album: "l'album", concert: 'le concert', finale: 'le SIF' };

export default function CareerHub({
  career,
  error,
  onBegin,
  onRest,
  onStudy,
  onSingle,
  onRelease,
  onConcert,
  onFinale,
  events,
  onDismissEvent,
  onChooseReward,
  changes,
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

  const turn = Math.min(career.turn, career.finalTurn);
  const over = career.failure !== null || career.finaleResult !== null;
  const liveActions = { album: onRelease, concert: onConcert, finale: onFinale };
  const { live } = career;
  // Every album, concert and the finale, dated with the turn it was played on.
  const releases = [
    career.release && { label: 'Album', turn: career.release.turn },
    career.concertResult && { label: 'Concert', turn: career.concertResult.turn },
    ...career.sorties.map(({ kind, turn: releasedAt }) => ({ label: kind === 'album' ? 'Album' : 'Concert', turn: releasedAt })),
    career.finaleResult && { label: 'SIF', turn: career.finaleResult.turn },
  ].filter((release) => release !== null);

  return (
    <section className="career-hub career-layout">
      <CareerEvent
        event={events[0] ?? null}
        choice={career.pendingChoice}
        onContinue={onDismissEvent}
        onChoose={onChooseReward}
      />

      <aside className="career-column" aria-label="Statistiques">
        <div className="career-status">
          <span>{`Tour ${turn}`}</span>
          <span className="career-status-item">
            {`Énergie ${career.energy} / ${career.maxEnergy}`}
            {changes?.energy ? <ChangeBadge label="Énergie" amount={changes.energy} /> : null}
          </span>
          <span className="career-status-item">
            {`Fans ${career.fans.current}`}
            {changes?.fans ? <ChangeBadge label="Fans" amount={changes.fans} /> : null}
          </span>
        </div>

        <StatBars stats={career.stats} statMax={career.statMax} changes={changes?.stats} />

        {releases.length > 0 && (
          <div className="career-history">
            <h2>Sorties</h2>
            <ul>
              {releases.map(({ label, turn: releasedAt }, index) => (
                // Releases are only ever appended, in the order they were played.
                <li key={index}>{`${label} : tour ${releasedAt}`}</li>
              ))}
            </ul>
          </div>
        )}

        <CareerNotebook notebook={career.notebook} />
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
          ) : live ? (
            <div className="actions">
              <button type="button" onClick={liveActions[live.kind]}>
                {`Poursuivre ${LIVE_LABELS[live.kind]} (${live.done} / ${live.total})`}
              </button>
            </div>
          ) : career.finaleDue ? (
            <div className="actions">
              <button type="button" onClick={onFinale}>
                Lancer le SIF
              </button>
            </div>
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
              {career.phase3 && (
                <div className="actions">
                  <button
                    type="button"
                    disabled={career.energy < career.liveCosts.album}
                    onClick={onRelease}
                  >{`Sortir un album (${career.liveCosts.album} énergies)`}</button>
                  <button
                    type="button"
                    disabled={career.energy < career.liveCosts.concert}
                    onClick={onConcert}
                  >{`Donner un concert (${career.liveCosts.concert} énergies)`}</button>
                </div>
              )}
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
        {career.sorties.map((sortie, index) => (
          <CareerResult
            // Sorties are only ever appended, in the order they were released.
            key={index}
            label={sortie.kind === 'album' ? 'Album' : 'Concert'}
            result={sortie}
          />
        ))}
        {career.finaleResult && <CareerResult label="SIF" result={career.finaleResult} />}
      </aside>
    </section>
  );
}
