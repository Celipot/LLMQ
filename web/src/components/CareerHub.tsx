import type { CareerChanges } from '../careerChanges';
import { CAREER_STATS } from '../careerStats';
import type { Career, CareerEvent as CareerEventData, CareerStat, Difficulty, RewardOption } from '../types';
import ActionButton from './ActionButton';
import CareerEvent from './CareerEvent';
import CareerNotebook from './CareerNotebook';
import CareerObjective from './CareerObjective';
import CareerResult from './CareerResult';
import CareerScore from './CareerScore';
import ChangeBadge from './ChangeBadge';
import StatBars from './StatBars';

interface CareerHubProps {
  career: Career | null;
  error: string | null;
  onBegin: (difficulty: Difficulty) => void;
  // Back to the choice of the difficulty, once the career is over.
  onRestart: () => void;
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

const energies = (amount: number) => `${amount} ${amount > 1 ? 'énergies' : 'énergie'}`;

const DIFFICULTY_LABELS: Record<Difficulty, string> = { normal: 'Mode Normal', hard: 'Mode Difficile' };

const DIFFICULTY_CHOICES: { difficulty: Difficulty; label: string; tooltip: string }[] = [
  {
    difficulty: 'normal',
    label: 'Normal',
    tooltip:
      "Plus accessible : intros plus longues, plus d'essais et de suggestions, un indice sur le titre à deviner, des objectifs allégés et aucun événement négatif.",
  },
  {
    difficulty: 'hard',
    label: 'Difficile',
    tooltip:
      "Le mode d'origine : intros courtes, peu d'essais et de suggestions, aucun indice, des objectifs exigeants et des événements négatifs.",
  },
];

const LIVE_LABELS = { album: "l'album", concert: 'le concert', finale: 'le SIF' };

export default function CareerHub({
  career,
  error,
  onBegin,
  onRestart,
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
        <p className="subtitle">Suivre la carrière d'A・ZU・NA</p>
        <div className="actions">
          {DIFFICULTY_CHOICES.map(({ difficulty, label, tooltip }) => (
            <ActionButton key={difficulty} tooltip={tooltip} onClick={() => onBegin(difficulty)}>
              {label}
            </ActionButton>
          ))}
        </div>
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
          <span>{DIFFICULTY_LABELS[career.difficulty]}</span>
          <span className="career-status-item">
            {`Énergie ${career.energy} / ${career.maxEnergy}`}
            {changes?.energy ? <ChangeBadge label="Énergie" amount={changes.energy} /> : null}
          </span>
          <span className="career-status-item">
            {`Fans ${career.fans.current}`}
            {changes?.fans ? <ChangeBadge label="Fans" amount={changes.fans} /> : null}
          </span>
        </div>

        <StatBars
          stats={career.stats}
          statMax={career.statMax}
          statStep={career.statStep}
          baseTiers={career.baseTiers}
          baseSuggestions={career.baseSuggestions}
          changes={changes?.stats} />

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
        <img className="career-illustration" src="/career-illustration.png" alt="Illustration de la carrière" />

        <div className="career-column" role="group" aria-label="Actions">
          {over ? (
            <>
              {career.finalScore && <CareerScore score={career.finalScore} />}
              <div className="actions">
                <button type="button" onClick={onRestart}>
                  Nouvelle carrière
                </button>
              </div>
            </>
          ) : live ? (
            <div className="actions">
              <ActionButton tooltip="Reprend la sortie là où elle s'est arrêtée." onClick={liveActions[live.kind]}>
                {`Poursuivre ${LIVE_LABELS[live.kind]} (${live.done} / ${live.total})`}
              </ActionButton>
            </div>
          ) : career.finaleDue ? (
            <div className="actions">
              <ActionButton
                tooltip="Dernière épreuve de la carrière : une longue suite de titres, sans coût d'énergie."
                onClick={onFinale}
              >
                Lancer le SIF
              </ActionButton>
            </div>
          ) : career.concertDue ? (
            <div className="actions">
              <ActionButton
                tooltip={`Rendez-vous imposé, sans coût d'énergie : ${career.concert.total} titres, dont une partie tirée du carnet. Ouvre la dernière phase.`}
                onClick={onConcert}
              >
                {career.concert.done > 0
                  ? `Poursuivre le concert (${career.concert.done} / ${career.concert.total})`
                  : 'Lancer le concert'}
              </ActionButton>
            </div>
          ) : career.releaseDue ? (
            <div className="actions">
              <ActionButton
                tooltip={`Rendez-vous imposé, sans coût d'énergie : ${career.album.total} titres, dont une partie tirée du carnet. Rapporte des fans.`}
                onClick={onRelease}
              >
                {career.album.done > 0
                  ? `Poursuivre l'album (${career.album.done} / ${career.album.total})`
                  : "Lancer la sortie de l'album"}
              </ActionButton>
            </div>
          ) : (
            <>
              <div className="actions">
                {CAREER_STATS.map(({ stat, label, studyLabel }) => (
                  <ActionButton
                    key={stat}
                    tooltip={`Coûte ${energies(career.costs.study)}. Fait progresser la stat « ${label} » selon la rapidité à trouver le titre, qui rejoint ensuite le carnet. Consomme un tour.`}
                    disabled={career.energy < career.costs.study}
                    onClick={() => onStudy(stat)}
                  >
                    {studyLabel}
                  </ActionButton>
                ))}
              </div>
              <div className="actions">
                <ActionButton
                  tooltip={`Coûte ${energies(career.costs.single)}. Fait progresser une stat tirée au hasard, plus qu'une étude, et gagne des fans. Le titre n'entre pas dans le carnet. Consomme un tour.`}
                  disabled={career.energy < career.costs.single}
                  onClick={onSingle}
                >
                  Se faire connaître
                </ActionButton>
              </div>
              {career.phase3 && (
                <div className="actions">
                  <ActionButton
                    tooltip={`Coûte ${energies(career.liveCosts.album)}. ${career.album.total} titres, dont une partie tirée du carnet. Rapporte des fans. Consomme un tour.`}
                    disabled={career.energy < career.liveCosts.album}
                    onClick={onRelease}
                  >{`Album (${career.liveCosts.album} énergies)`}</ActionButton>
                  <ActionButton
                    tooltip={`Coûte ${energies(career.liveCosts.concert)}. ${career.concert.total} titres, dont une partie tirée du carnet. Consomme un tour.`}
                    disabled={career.energy < career.liveCosts.concert}
                    onClick={onConcert}
                  >{`Concert (${career.liveCosts.concert} énergies)`}</ActionButton>
                </div>
              )}
              <div className="actions">
                <ActionButton
                  className="secondary"
                  tooltip="Rend toute l'énergie. Consomme un tour."
                  onClick={onRest}
                >
                  Repos
                </ActionButton>
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
