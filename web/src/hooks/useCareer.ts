import { useCallback, useState } from 'react';
import {
  ApiError,
  fetchCareer,
  releaseCareer,
  restCareer,
  startCareer,
  studyCareer,
  submitGuess,
  submitSkip,
} from '../api';
import type { Career, CareerResponse, CareerRound, CareerStat, GameState } from '../types';

export function useCareer() {
  const [career, setCareer] = useState<Career | null>(null);
  const [round, setRound] = useState<CareerRound | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((response: CareerResponse) => {
    setCareer(response.career);
    setRound(response.round);
    setError(null);
  }, []);

  // A refused action leaves the career as it was and only reports why.
  const run = useCallback(
    async (action: () => Promise<CareerResponse>) => {
      try {
        apply(await action());
      } catch (err) {
        setError(errorText(err));
      }
    },
    [apply],
  );

  const enter = useCallback(async () => {
    try {
      apply(await fetchCareer());
    } catch (err) {
      // No career yet is the normal first visit, not a failure.
      if (err instanceof ApiError && err.code === 'NO_CAREER') return;
      setError(errorText(err));
    }
  }, [apply]);

  const begin = useCallback(() => run(startCareer), [run]);
  const rest = useCallback(() => run(restCareer), [run]);
  const study = useCallback((stat: CareerStat) => run(() => studyCareer(stat)), [run]);
  const release = useCallback(() => run(releaseCareer), [run]);

  // The round outcome comes back on the last guess/skip together with the
  // updated career; while it goes on only the round state changes.
  const applyRoundResult = useCallback((state: GameState, updatedCareer?: Career) => {
    setRound((previous) => (previous ? { ...previous, state } : previous));
    if (updatedCareer) setCareer(updatedCareer);
    setError(null);
  }, []);

  const guess = useCallback(
    async (title: string) => {
      if (!title.trim()) {
        setError('Entrer un titre avant de valider.');
        return;
      }
      try {
        const res = await submitGuess(title);
        applyRoundResult(res.state, res.career);
      } catch (err) {
        setError(errorText(err));
      }
    },
    [applyRoundResult],
  );

  const skip = useCallback(async () => {
    try {
      const res = await submitSkip();
      applyRoundResult(res.state, res.career);
    } catch (err) {
      setError(errorText(err));
    }
  }, [applyRoundResult]);

  const closeRound = useCallback(() => setRound(null), []);
  const clearError = useCallback(() => setError(null), []);

  return { career, round, error, enter, begin, rest, study, release, guess, skip, closeRound, clearError };
}

function errorText(err: unknown): string {
  const code = err instanceof ApiError ? err.code : 'UNKNOWN_ERROR';
  switch (code) {
    case 'NO_ENERGY':
      return "Pas assez d'énergie pour étudier : il faut se reposer.";
    case 'ROUND_IN_PROGRESS':
      return 'Un round est déjà en cours.';
    case 'UNKNOWN_TITLE':
      return 'Ce titre ne fait pas partie des chansons jouables.';
    case 'TITLE_REQUIRED':
      return 'Entrer un titre avant de valider.';
    case 'GAME_FINISHED':
      return 'Le round est terminé.';
    default:
      return 'Une erreur est survenue.';
  }
}
