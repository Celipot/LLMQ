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
import type { GameState, PlayableSong, RoundResult, SongHistory } from '../types';

export function useGameState(onRandomRoundFinished?: (result: RoundResult) => void) {
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

  // Only a Random round feeds the adaptive draw: in List mode the player picks
  // the song (activeSongId is set), so the result says nothing about difficulty.
  const reportFinishedRound = useCallback(
    (s: GameState) => {
      if (activeSongId !== null || s.status === 'playing' || s.correctSongId === undefined) return;
      onRandomRoundFinished?.({ songId: s.correctSongId, won: s.status === 'won', stage: s.attemptsUsed });
    },
    [activeSongId, onRandomRoundFinished],
  );

  const guess = useCallback(
    async (title: string) => {
      if (!title.trim()) {
        setError('Entrer un titre avant de valider.');
        return;
      }
      try {
        const res = await submitGuess(title);
        setState(res.state);
        setError(null);
        refreshTitles();
        reportFinishedRound(res.state);
      } catch (err) {
        setError(errorText(err));
      }
    },
    [refreshTitles, reportFinishedRound],
  );

  const skip = useCallback(async () => {
    try {
      const res = await submitSkip();
      setState(res.state);
      setError(null);
      refreshTitles();
      reportFinishedRound(res.state);
    } catch (err) {
      setError(errorText(err));
    }
  }, [refreshTitles, reportFinishedRound]);

  const reset = useCallback(async (history?: SongHistory) => {
    const s = await resetGame(history);
    setState(s);
    setError(null);
    refreshTitles();
  }, [refreshTitles]);

  const startRandom = useCallback(async (generations?: string[], history?: SongHistory) => {
    const s = await startRandomMode(generations, history);
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
      return 'Entrer un titre avant de valider.';
    case 'GAME_FINISHED':
      return 'La partie est terminée.';
    default:
      return 'Une erreur est survenue.';
  }
}
