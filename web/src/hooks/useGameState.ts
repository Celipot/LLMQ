import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchState, fetchTitles, resetGame, submitGuess, submitSkip } from '../api';
import type { GameState, PlayableSong } from '../types';

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [titles, setTitles] = useState<PlayableSong[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchTitles(), fetchState()]).then(([t, s]) => {
      setTitles(t);
      setState(s);
    });
  }, []);

  const guess = useCallback(async (title: string) => {
    if (!title.trim()) {
      setError('Entre un titre avant de valider.');
      return;
    }
    try {
      const res = await submitGuess(title);
      setState(res.state);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  const skip = useCallback(async () => {
    try {
      const res = await submitSkip();
      setState(res.state);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  const reset = useCallback(async () => {
    const s = await resetGame();
    setState(s);
    setError(null);
  }, []);

  return { state, titles, error, guess, skip, reset, clearError: () => setError(null) };
}

function errorText(err: unknown): string {
  const code = err instanceof ApiError ? err.code : 'UNKNOWN_ERROR';
  switch (code) {
    case 'UNKNOWN_TITLE':
      return 'Ce titre ne fait pas partie des chansons jouables.';
    case 'TITLE_REQUIRED':
      return 'Entre un titre avant de valider.';
    case 'GAME_FINISHED':
      return 'La partie est terminée.';
    default:
      return 'Une erreur est survenue.';
  }
}
