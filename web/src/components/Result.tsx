import type { GameState } from '../types';

interface ResultProps {
  state: GameState;
  onReset?: () => void;
}

export default function Result({ state, onReset }: ResultProps) {
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
      {onReset && (
        <button type="button" className="secondary" onClick={onReset}>
          Rejouer
        </button>
      )}
    </section>
  );
}
