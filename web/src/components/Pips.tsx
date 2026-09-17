import type { GuessEntry } from '../types';

interface PipsProps {
  maxAttempts: number;
  guesses: GuessEntry[];
}

export default function Pips({ maxAttempts, guesses }: PipsProps) {
  return (
    <section className="pips" aria-label="Tentatives">
      {Array.from({ length: maxAttempts }, (_, i) => {
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
