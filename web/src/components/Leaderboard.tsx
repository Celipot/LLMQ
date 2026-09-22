import { useState } from 'react';
import { CAREER_GENERATIONS } from '../careerGenerations';
import type { Generation, Leaderboards } from '../types';

interface LeaderboardProps {
  leaderboards: Leaderboards;
}

export default function Leaderboard({ leaderboards }: LeaderboardProps) {
  const [generation, setGeneration] = useState<Generation>('nijigasaki');
  const entries = leaderboards[generation] ?? [];

  return (
    <section className="career-leaderboard" aria-label="Classement du mode Infini">
      <h2>Classement du mode Infini</h2>
      <div className="actions" role="group" aria-label="Franchise du classement">
        {CAREER_GENERATIONS.map(({ generation: choice, label }) => (
          <button
            key={choice}
            type="button"
            className={choice === generation ? undefined : 'secondary'}
            aria-pressed={choice === generation}
            onClick={() => setGeneration(choice)}
          >
            {label}
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <p className="subtitle">Aucun score pour le moment.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Rang</th>
              <th scope="col">Pseudo</th>
              <th scope="col">Tour</th>
              <th scope="col">Score</th>
              <th scope="col">Grade</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ username, turn, score, grade }, index) => (
              // The board is rebuilt as a whole by the server: an entry has no id of its own.
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{username}</td>
                <td>{turn}</td>
                <td>{score}</td>
                <td>{grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
