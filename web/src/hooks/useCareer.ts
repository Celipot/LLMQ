import { useCallback, useEffect, useRef, useState } from 'react';
import { computeChanges, type CareerChanges } from '../careerChanges';
import {
  abandonCareer,
  ApiError,
  chooseCareerReward,
  concertCareer,
  fetchCareer,
  finaleCareer,
  releaseCareer,
  restCareer,
  singleCareer,
  startCareer,
  studyCareer,
  submitGuess,
  submitSkip,
} from '../api';
import type {
  Career,
  CareerEvent,
  CareerResponse,
  CareerRound,
  CareerStat,
  Difficulty,
  GameState,
  RewardOption,
  Unit,
} from '../types';

const CHANGES_HIGHLIGHT_MS = 5000;

export function useCareer() {
  const [career, setCareer] = useState<Career | null>(null);
  const [round, setRound] = useState<CareerRound | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Events fired by the last action, acknowledged one at a time by the player.
  const [events, setEvents] = useState<CareerEvent[]>([]);
  // The changes of a finished round are kept aside while its result is on screen, and
  // highlighted for a few seconds once the hub, where the values are shown, is back.
  const careerRef = useRef<Career | null>(null);
  careerRef.current = career;
  const [pendingChanges, setPendingChanges] = useState<CareerChanges | null>(null);
  const [changes, setChanges] = useState<CareerChanges | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearChanges = useCallback(() => {
    clearTimeout(highlightTimer.current);
    setPendingChanges(null);
    setChanges(null);
  }, []);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  const apply = useCallback((response: CareerResponse) => {
    clearChanges();
    setCareer(response.career);
    setRound(response.round);
    setEvents(response.career.newEvents);
    setError(null);
  }, [clearChanges]);

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

  // Coming back to the hub replays no event: the player has already seen them.
  const enter = useCallback(async () => {
    try {
      const response = await fetchCareer();
      apply(response);
      setEvents([]);
    } catch (err) {
      // No career yet is the normal first visit, not a failure.
      if (err instanceof ApiError && err.code === 'NO_CAREER') return;
      setError(errorText(err));
    }
  }, [apply]);

  const begin = useCallback(
    (choice: { unit: Unit; difficulty: Difficulty }) => run(() => startCareer(choice)),
    [run],
  );

  const abandon = useCallback(async () => {
    try {
      await abandonCareer();
      setCareer(null);
      setRound(null);
      setEvents([]);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);
  const rest = useCallback(() => run(restCareer), [run]);
  const study = useCallback((stat: CareerStat) => run(() => studyCareer(stat)), [run]);
  const single = useCallback(() => run(singleCareer), [run]);
  const release = useCallback(() => run(releaseCareer), [run]);
  const concert = useCallback(() => run(concertCareer), [run]);
  const finale = useCallback(() => run(finaleCareer), [run]);
  const chooseReward = useCallback((option: RewardOption) => run(() => chooseCareerReward(option)), [run]);
  const dismissEvent = useCallback(() => setEvents((previous) => previous.slice(1)), []);

  // The round outcome comes back on the last guess/skip together with the
  // updated career; while it goes on only the round state changes.
  const applyRoundResult = useCallback((state: GameState, updatedCareer?: Career) => {
    setRound((previous) => (previous ? { ...previous, state } : previous));
    if (updatedCareer) {
      if (careerRef.current) setPendingChanges(computeChanges(careerRef.current, updatedCareer));
      setCareer(updatedCareer);
      setEvents(updatedCareer.newEvents);
    }
    setError(null);
  }, []);

  const guess = useCallback(
    async (title: string) => {
      if (!title.trim()) {
        setError('Entrer un titre avant de valider.');
        return;
      }
      try {
        const res = await submitGuess(title, 'career');
        applyRoundResult(res.state, res.career);
      } catch (err) {
        setError(errorText(err));
      }
    },
    [applyRoundResult],
  );

  const skip = useCallback(async () => {
    try {
      const res = await submitSkip('career');
      applyRoundResult(res.state, res.career);
    } catch (err) {
      setError(errorText(err));
    }
  }, [applyRoundResult]);

  const closeRound = useCallback(() => {
    setRound(null);
    if (!pendingChanges) return;
    setChanges(pendingChanges);
    setPendingChanges(null);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setChanges(null), CHANGES_HIGHLIGHT_MS);
  }, [pendingChanges]);
  const clearError = useCallback(() => setError(null), []);

  return {
    career,
    round,
    events,
    changes,
    error,
    enter,
    begin,
    abandon,
    rest,
    study,
    single,
    release,
    concert,
    finale,
    chooseReward,
    dismissEvent,
    guess,
    skip,
    closeRound,
    clearError,
  };
}

function errorText(err: unknown): string {
  const code = err instanceof ApiError ? err.code : 'UNKNOWN_ERROR';
  switch (code) {
    case 'NO_ENERGY':
      return "Pas assez d'énergie : il faut se reposer.";
    case 'ROUND_IN_PROGRESS':
      return 'Un round est déjà en cours.';
    case 'EVENT_PENDING':
      return 'Choisir une récompense avant de continuer.';
    case 'RELEASE_IN_PROGRESS':
      return 'Terminer la sortie en cours avant de faire autre chose.';
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
