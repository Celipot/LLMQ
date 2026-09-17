import type { GuessEntry } from '../types';

interface PipsProps {
  maxAttempts: number;
  guesses: GuessEntry[];
}

export default function Pips({ maxAttempts, guesses }: PipsProps) {
  // The final attempt never earns a longer clip — it's a guess-or-abandon
  // decision resolved by the Result panel, so it gets no pip of its own.
  const visibleAttempts = Math.max(0, maxAttempts - 1);
  return (
    <section className="pips" aria-label="Tentatives">
      {Array.from({ length: visibleAttempts }, (_, i) => {
        const entry = guesses[i];
        let extraClass = '';
        if (entry) {
          if (entry.type === 'skip') extraClass = 'used-skip';
          else extraClass = entry.correct ? 'used-correct' : 'used-wrong';
        }
        return <div key={i} className={`pip ${extraClass}`} />;
      })}
    </section>
  );
}
