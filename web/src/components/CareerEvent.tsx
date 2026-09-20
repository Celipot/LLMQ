import type { CareerEvent as CareerEventData, PendingChoice, RewardOption } from '../types';

interface CareerEventProps {
  event: CareerEventData | null;
  choice: PendingChoice | null;
  onContinue: () => void;
  onChoose: (option: RewardOption) => void;
}

// An event fired by the last action, shown until the player goes on. A series
// reward is not an event to acknowledge but a choice to make, shown once the
// events queued before it have been seen.
export default function CareerEvent({ event, choice, onContinue, onChoose }: CareerEventProps) {
  if (!event && !choice) return null;

  return (
    <div className="career-event" role="dialog" aria-modal="true" aria-label="Événement">
      <div className="career-event-card">
        <img className="career-event-image" src="/career-event-placeholder.svg" alt="Illustration de l'événement" />
        {event ? (
          <>
            <p className="career-event-text">{event.text}</p>
            {event.gained && (
              <div className="career-event-gained">
                <p>Titres ajoutés au carnet</p>
                <ul>
                  {event.gained.map((song) => (
                    <li key={song.id}>{song.title}</li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" onClick={onContinue}>
              Continuer
            </button>
          </>
        ) : (
          choice && (
            <>
              <p className="career-event-text">Série de bonnes réponses ! Choisir la récompense.</p>
              <div className="actions">
                <button type="button" onClick={() => onChoose('stats')}>
                  {`Toutes les stats +${choice.options.stats.amount}`}
                </button>
                <button type="button" onClick={() => onChoose('energy')}>
                  {`Énergie +${choice.options.energy.amount}`}
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
