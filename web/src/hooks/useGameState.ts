import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  fetchState,
  fetchTitles,
  resetGame,
  selectSong as selectSongApi,
  startRandomMode,
  submitGuess,
  submitSkip,
} from '../api';
import type { GameState, PlayableSong } from '../types';

export function useGameState() {
  const [state, setState] = useState<GameState | null>(null);
  const [titles, setTitles] = useState<PlayableSong[]>([]);
  const [activeSongId, setActiveSongId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshTitles = useCallback(() => {
    fetchTitles().then(setTitles);
  }, []);

  useEffect(() => {
    Promise.all([fetchTitles(), fetchState()]).then(([t, s]) => {
      setTitles(t);
      setState(s);
    });
  }, []);

  const guess = useCallback(
    async (title: string) => {
      if (!title.trim()) {
        setError('Entre un titre avant de valider.');
        return;
      }
      try {
        const res = await submitGuess(title);
        setState(res.state);
        setError(null);
        refreshTitles();
      } catch (err) {
        setError(errorText(err));
      }
    },
    [refreshTitles],
  );

  const skip = useCallback(async () => {
    try {
      const res = await submitSkip();
      setState(res.state);
      setError(null);
      refreshTitles();
    } catch (err) {
      setError(errorText(err));
    }
  }, [refreshTitles]);

  const reset = useCallback(async () => {
    const s = await resetGame();
    setState(s);
    setError(null);
    refreshTitles();
  }, [refreshTitles]);

  const startRandom = useCallback(async () => {
    const s = await startRandomMode();
    setState(s);
    setActiveSongId(null);
    setError(null);
  }, []);

  const selectSong = useCallback(
    async (id: number) => {
      const s = await selectSongApi(id);
      setState(s);
      setActiveSongId(id);
      setError(null);
      refreshTitles();
    },
    [refreshTitles],
  );

  return {
    state,
    titles,
    activeSongId,
    error,
    guess,
    skip,
    reset,
    startRandom,
    selectSong,
    clearError: () => setError(null),
  };
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
