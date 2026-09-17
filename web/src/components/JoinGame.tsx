import { useEffect, useState } from 'react';
import { ApiError, fetchGameStatus, joinGame } from '../api';

interface JoinGameProps {
  gameId: string;
  onJoined: (playerId: string) => void;
}

type LoadState = 'loading' | 'joinable' | 'locked' | 'not_found';

export default function JoinGame({ gameId, onJoined }: JoinGameProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGameStatus(gameId)
      .then((game) => {
        if (cancelled) return;
        setLoadState(game.status === 'lobby' ? 'joinable' : 'locked');
      })
      .catch(() => {
        if (!cancelled) setLoadState('not_found');
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  async function handleSubmit() {
    if (nickname.trim() === '') {
      setError('Entre un pseudo avant de valider.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { playerId } = await joinGame(gameId, nickname.trim());
      onJoined(playerId);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NICKNAME_TAKEN') {
        setError('Ce pseudo est déjà pris, choisis-en un autre.');
      } else if (err instanceof ApiError && err.code === 'GAME_NOT_JOINABLE') {
        setLoadState('locked');
      } else {
        setError('Impossible de rejoindre la partie. Réessaie.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === 'loading') {
    return <p className="subtitle">Chargement de la partie...</p>;
  }

  if (loadState === 'not_found') {
    return (
      <p className="error-msg" role="alert">
        Cette partie n'existe pas.
      </p>
    );
  }

  if (loadState === 'locked') {
    return (
      <p className="error-msg" role="alert">
        Cette partie a déjà commencé, elle n'est plus accessible en rejoignage.
      </p>
    );
  }

  return (
    <section className="join-game">
      <p className="subtitle">Rejoins la partie</p>
      <input
        type="text"
        aria-label="Pseudo"
        placeholder="Ton pseudo"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <button type="button" onClick={handleSubmit} disabled={submitting}>
        Rejoindre
      </button>
      {error && (
        <p className="error-msg" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
