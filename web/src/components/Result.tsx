import type { GameState } from '../types';

interface ResultProps {
  state: GameState;
  onNextSong?: () => void;
  onHome?: () => void;
}

export default function Result({ state, onNextSong, onHome }: ResultProps) {
  return (
    <section className="result">
      <h2>{state.status === 'won' ? 'Gagné !' : 'Perdu'}</h2>
      {state.correctCoverUrl && (
        <img className="result-cover" src={state.correctCoverUrl} alt={state.correctTitle} />
      )}
      <p>
        La chanson était : {state.correctTitle} — {state.correctArtist}
      </p>
      <p>
        Essais utilisés : {state.attemptsUsed} / {state.maxAttempts}
      </p>
      {(onNextSong || onHome) && (
        <div className="result-actions">
          {onNextSong && (
            <button type="button" onClick={onNextSong}>
              Musique suivante
            </button>
          )}
          {onHome && (
            <button type="button" className="secondary" onClick={onHome}>
              Accueil
            </button>
          )}
        </div>
      )}
    </section>
  );
}
