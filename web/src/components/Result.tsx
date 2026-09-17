import type { GameState } from '../types';

interface ResultProps {
  state: GameState;
  onReset: () => void;
}

export default function Result({ state, onReset }: ResultProps) {
  return (
    <section className="result">
      <h2>{state.status === 'won' ? 'Gagné !' : 'Perdu'}</h2>
      <p>La chanson était : {state.correctTitle}</p>
      <p>
        Essais utilisés : {state.attemptsUsed} / {state.maxAttempts}
      </p>
      <button type="button" className="secondary" onClick={onReset}>
        Rejouer (dev)
      </button>
    </section>
  );
}
