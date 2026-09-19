import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchGameStatus, joinGame } from '../api';

interface JoinGameProps {
  gameId: string;
  defaultNickname?: string;
  defaultAvatar?: string;
  onJoined: (playerId: string) => void;
}

type LoadState = 'loading' | 'joinable' | 'locked' | 'not_found';

export default function JoinGame({ gameId, defaultNickname = '', defaultAvatar, onJoined }: JoinGameProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [nickname, setNickname] = useState(defaultNickname);
  // The profile username joins without asking: the form only appears when
  // there is none, or when that automatic attempt fails (e.g. nickname taken).
  const [autoJoining, setAutoJoining] = useState(defaultNickname.trim() !== '');
  const autoJoinStarted = useRef(false);
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

  const join = useCallback(
    async (name: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const hostToken = localStorage.getItem(`hostToken:${gameId}`) ?? undefined;
        let joined;
        try {
          joined = await joinGame(gameId, name, hostToken, defaultAvatar);
        } catch (err) {
          // A stale or corrupted stored picture must never keep the player out.
          if (!(err instanceof ApiError && err.code === 'INVALID_AVATAR' && defaultAvatar)) throw err;
          joined = await joinGame(gameId, name, hostToken, undefined);
        }
        const { playerId } = joined;
        localStorage.setItem(`playerId:${gameId}`, playerId);
        onJoined(playerId);
      } catch (err) {
        setAutoJoining(false);
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
    },
    [gameId, onJoined, defaultAvatar],
  );

  useEffect(() => {
    if (loadState !== 'joinable' || !autoJoining || autoJoinStarted.current) return;
    autoJoinStarted.current = true;
    join(defaultNickname.trim());
  }, [loadState, autoJoining, defaultNickname, join]);

  function handleSubmit() {
    if (nickname.trim() === '') {
      setError('Entre un pseudo avant de valider.');
      return;
    }
    join(nickname.trim());
  }

  if (loadState === 'loading' || (loadState === 'joinable' && autoJoining)) {
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
