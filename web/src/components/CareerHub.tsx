import type { CareerChanges } from '../careerChanges';
import { CAREER_STATS } from '../careerStats';
import { useState } from 'react';
import { useEnterKey } from '../hooks/useEnterKey';
import { illustrationFor } from '../careerIllustrations';
import { CAREER_UNITS } from '../careerUnits';
import { CAREER_GENERATIONS } from '../careerGenerations';
import type {
  Career,
  CareerChoice,
  CareerEvent as CareerEventData,
  CareerStat,
  Difficulty,
  Generation,
  Leaderboards,
  RewardOption,
  Unit,
} from '../types';
import ActionButton from './ActionButton';
import CareerEvent from './CareerEvent';
import CareerNotebook from './CareerNotebook';
import CareerObjective from './CareerObjective';
import CareerResult from './CareerResult';
import CareerScore from './CareerScore';
import ChangeBadge from './ChangeBadge';
import Leaderboard from './Leaderboard';
import StatBars from './StatBars';

interface CareerHubProps {
  career: Career | null;
  error: string | null;
  onBegin: (choice: CareerChoice) => void;
  // The username of the profile, needed by the infinite mode, and its best runs.
  username: string;
  leaderboards: Leaderboards;
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

// The 4 franchises a unit can belong to; 'all' (the whole library) only exists for the
// infinite mode, which follows no single unit.
const UNIT_GENERATIONS = CAREER_GENERATIONS.filter(({ generation }) => generation !== 'all');

export default function CareerHub({
  career,
  error,
  onBegin,
  username,
  leaderboards,
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
  const [unit, setUnit] = useState<Unit>(CAREER_UNITS[0].unit);
  const [infiniteGeneration, setInfiniteGeneration] = useState<Generation>('nijigasaki');

  useEnterKey(!!events[0], onDismissEvent);

  if (!career) {
    const { label: unitLabel } = CAREER_UNITS.find((choice) => choice.unit === unit) ?? CAREER_UNITS[0];
    const infiniteLabel = CAREER_GENERATIONS.find((choice) => choice.generation === infiniteGeneration)?.label;
    return (
      <section className="career-hub">
        {UNIT_GENERATIONS.map(({ generation, label }) => (
          <div key={generation} className="actions" role="group" aria-label={`Unités ${label}`}>
            {CAREER_UNITS.filter((choice) => choice.generation === generation).map((choice) => (
              <button
                key={choice.unit}
                type="button"
                className={choice.unit === unit ? undefined : 'secondary'}
                aria-pressed={choice.unit === unit}
                onClick={() => setUnit(choice.unit)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ))}
        <p className="subtitle">{`Suivre la carrière de ${unitLabel}`}</p>
        <div className="actions">
          {DIFFICULTY_CHOICES.map(({ difficulty, label, tooltip }) => (
            <ActionButton key={difficulty} tooltip={tooltip} onClick={() => onBegin({ unit, difficulty })}>
              {label}
            </ActionButton>
          ))}
        </div>
        <div className="actions" role="group" aria-label="Franchise (Mode Infini)">
          {CAREER_GENERATIONS.map(({ generation, label }) => (
            <button
              key={generation}
              type="button"
              className={generation === infiniteGeneration ? undefined : 'secondary'}
              aria-pressed={generation === infiniteGeneration}
              onClick={() => setInfiniteGeneration(generation)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="actions">
          <ActionButton
            tooltip={`Une carrière sans fin sur toute la discographie de ${infiniteLabel} : après chaque SIF la dernière phase recommence, de plus en plus dure, jusqu'à l'échec. Le score entre dans le classement.`}
            disabled={!username}
            onClick={() => onBegin({ mode: 'infinite', username, generation: infiniteGeneration })}
          >
            Mode Infini
          </ActionButton>
        </div>
        {!username && <p className="subtitle">Choisir un pseudo dans le profil pour jouer en mode Infini.</p>}
        {error && (
          <p className="error-msg" role="alert">
            {error}
          </p>
        )}
        <Leaderboard leaderboards={leaderboards} />
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
    ...career.finales.map(({ turn: releasedAt }) => ({ label: 'SIF', turn: releasedAt })),
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
          {career.mode === 'infinite' ? (
            <>
              <span>Mode Infini</span>
              <span>{CAREER_GENERATIONS.find((choice) => choice.generation === career.generation)?.label}</span>
              <span>{`Boucle ${career.cycle}`}</span>
            </>
          ) : (
            <>
              <span>{CAREER_UNITS.find((choice) => choice.unit === career.unit)?.label}</span>
              <span>{DIFFICULTY_LABELS[career.difficulty]}</span>
            </>
          )}
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
        <img className="career-illustration" {...illustrationFor(career.unit, 'career')} />

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
