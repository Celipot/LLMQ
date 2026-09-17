import type { GuessEntry } from '../types';

interface HistoryProps {
  guesses: GuessEntry[];
}

export default function History({ guesses }: HistoryProps) {
  return (
    <section className="history" aria-label="Historique des tentatives">
      {guesses.map((entry, i) =>
        entry.type === 'skip' ? (
          <div key={i} className="history-item skip">
            <span>#{i + 1}</span>
            <span>Skip</span>
          </div>
        ) : (
          <div key={i} className={`history-item ${entry.correct ? 'correct' : 'wrong'}`}>
            <span>#{i + 1}</span>
            <span>{entry.title}</span>
          </div>
        )
      )}
    </section>
  );
}
