import type { GameState, SongStats } from '../types';

interface ResultProps {
  state: GameState;
  stats?: SongStats | null;
  onNextSong?: () => void;
  onHome?: () => void;
}

export default function Result({ state, stats, onNextSong, onHome }: ResultProps) {
  const successRate = stats ? Math.round((stats.wins / stats.plays) * 100) : null;
  const avgStage = stats && stats.wins > 0 ? (stats.stageSum / stats.wins).toFixed(1) : null;
  const losses = stats ? stats.plays - stats.wins : null;

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
      {stats && (
        <div className="result-stats">
          <p>{`Réussite sur cette chanson : ${successRate}% (${stats.wins}/${stats.plays})`}</p>
          {avgStage && <p>{`Étape moyenne de découverte : ${avgStage}`}</p>}
          <p>{`Passée ${losses} fois`}</p>
        </div>
      )}
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
