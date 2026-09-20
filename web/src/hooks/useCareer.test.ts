import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useCareer } from './useCareer';
import * as api from '../api';
import { ApiError } from '../api';
import type { Career, CareerResponse, GameState } from '../types';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    fetchCareer: vi.fn(),
    startCareer: vi.fn(),
    restCareer: vi.fn(),
    studyCareer: vi.fn(),
    singleCareer: vi.fn(),
    releaseCareer: vi.fn(),
    concertCareer: vi.fn(),
    finaleCareer: vi.fn(),
    chooseCareerReward: vi.fn(),
    abandonCareer: vi.fn(),
    submitGuess: vi.fn(),
    submitSkip: vi.fn(),
  };
});

const career: Career = {
  turn: 1,
  concertAt: 20,
  finalTurn: 50,
  statMax: { oreille: 300, memoire: 300, culture: 200 },
  modifiers: [],
  phase3: false,
  sorties: [],
  liveCosts: { album: 3, concert: 4 },
  live: null,
  finaleGoals: {
    concerts: { done: 0, good: 0, required: 2, requiredGood: 2 },
    albums: { done: 0, good: 0, required: 3, requiredGood: 2 },
    met: false,
  },
  finaleDue: false,
  finaleResult: null,
  events: [],
  newEvents: [],
  pendingChoice: null,
  releaseAt: 10,
  energy: 4,
  maxEnergy: 4,
  stats: { oreille: 0, memoire: 0, culture: 0 },
  suggestionCount: 1,
  notebook: [],
  releaseDue: false,
  album: { done: 0, total: 6 },
  release: null,
  concertDue: false,
  concert: { done: 0, total: 15 },
  concertResult: null,
  fans: { current: 0, required: 300 },
  failure: null,
  albumGoalGrade: 'B',
  finalScore: null,
};

const playing: GameState = { attemptsUsed: 0, maxAttempts: 3, allowedSeconds: 1, status: 'playing', guesses: [] };
const studyRound: CareerResponse = { career, round: { kind: 'study', stat: 'oreille', inNotebook: false, state: playing } };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useCareer', () => {
  test('enter() loads the career and its round in progress', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue(studyRound);
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.enter();
    });

    expect(result.current.career).toEqual(career);
    expect(result.current.round?.kind).toBe('study');
    expect(result.current.error).toBeNull();
  });

  test('enter() without a career leaves it empty and shows no error', async () => {
    vi.mocked(api.fetchCareer).mockRejectedValue(new ApiError('NO_CAREER'));
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.enter();
    });

    expect(result.current.career).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('begin() starts a new career', async () => {
    vi.mocked(api.startCareer).mockResolvedValue({ career, round: null });
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.begin();
    });

    expect(result.current.career).toEqual(career);
    expect(result.current.round).toBeNull();
  });

  test('study() starts the round for the chosen stat', async () => {
    vi.mocked(api.studyCareer).mockResolvedValue(studyRound);
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.study('oreille');
    });

    expect(api.studyCareer).toHaveBeenCalledWith('oreille');
    expect(result.current.round?.stat).toBe('oreille');
  });

  test('rest() updates the career', async () => {
    vi.mocked(api.restCareer).mockResolvedValue({ career: { ...career, turn: 2 }, round: null });
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.rest();
    });

    expect(result.current.career?.turn).toBe(2);
  });

  test('a refused study shows a readable message and keeps the career', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({ career, round: null });
    vi.mocked(api.studyCareer).mockRejectedValue(new ApiError('NO_ENERGY'));
    const { result } = renderHook(() => useCareer());
    await act(async () => {
      await result.current.enter();
    });

    await act(async () => {
      await result.current.study('memoire');
    });

    expect(result.current.error).toBe("Pas assez d'énergie : il faut se reposer.");
    expect(result.current.career).toEqual(career);
  });

  test('single() starts a single round on the stat drawn by the server', async () => {
    vi.mocked(api.singleCareer).mockResolvedValue({
      career,
      round: { kind: 'single', stat: 'culture', inNotebook: false, state: playing },
    });
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.single();
    });

    expect(api.singleCareer).toHaveBeenCalledOnce();
    expect(result.current.round?.stat).toBe('culture');
    expect(result.current.round?.kind).toBe('single');
  });

  test('abandon() forgets the career and its round, so the first screen comes back', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue(studyRound);
    vi.mocked(api.abandonCareer).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCareer());
    await act(async () => {
      await result.current.enter();
    });

    await act(async () => {
      await result.current.abandon();
    });

    expect(api.abandonCareer).toHaveBeenCalledOnce();
    expect(result.current.career).toBeNull();
    expect(result.current.round).toBeNull();
  });

  test('a failed abandon keeps the career and shows an error', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({ career, round: null });
    vi.mocked(api.abandonCareer).mockRejectedValue(new ApiError('UNKNOWN_ERROR'));
    const { result } = renderHook(() => useCareer());
    await act(async () => {
      await result.current.enter();
    });

    await act(async () => {
      await result.current.abandon();
    });

    expect(result.current.career).toEqual(career);
    expect(result.current.error).toBe('Une erreur est survenue.');
  });

  test('concert() starts the next track of the concert', async () => {
    vi.mocked(api.concertCareer).mockResolvedValue({
      career,
      round: { kind: 'concert', stat: null, inNotebook: false, state: playing },
    });
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.concert();
    });

    expect(api.concertCareer).toHaveBeenCalledOnce();
    expect(result.current.round?.kind).toBe('concert');
  });

  test('guess() updates the round state without touching the career while the round goes on', async () => {
    vi.mocked(api.studyCareer).mockResolvedValue(studyRound);
    const wrong: GameState = { ...playing, attemptsUsed: 1 };
    vi.mocked(api.submitGuess).mockResolvedValue({ correct: false, state: wrong });
    const { result } = renderHook(() => useCareer());
    await act(async () => {
      await result.current.study('oreille');
    });

    await act(async () => {
      await result.current.guess('Wrong');
    });

    expect(result.current.round?.state.attemptsUsed).toBe(1);
    expect(result.current.career).toEqual(career);
  });

  test('the last guess of a round brings the updated career, and the round stays until closed', async () => {
    vi.mocked(api.studyCareer).mockResolvedValue(studyRound);
    const won: GameState = { ...playing, attemptsUsed: 1, status: 'won', correctTitle: 'Song' };
    const after: Career = { ...career, turn: 2, energy: 2, stats: { ...career.stats, oreille: 80 } };
    vi.mocked(api.submitGuess).mockResolvedValue({ correct: true, state: won, career: after });
    const { result } = renderHook(() => useCareer());
    await act(async () => {
      await result.current.study('oreille');
    });

    await act(async () => {
      await result.current.guess('Song');
    });

    expect(result.current.career).toEqual(after);
    expect(result.current.round?.state.status).toBe('won');

    act(() => result.current.closeRound());
    expect(result.current.round).toBeNull();
  });

  test('skip() updates the round state', async () => {
    vi.mocked(api.studyCareer).mockResolvedValue(studyRound);
    vi.mocked(api.submitSkip).mockResolvedValue({ state: { ...playing, attemptsUsed: 1 } });
    const { result } = renderHook(() => useCareer());
    await act(async () => {
      await result.current.study('oreille');
    });

    await act(async () => {
      await result.current.skip();
    });

    expect(result.current.round?.state.attemptsUsed).toBe(1);
  });
});

describe('useCareer events', () => {
  const withEvents = (events: Career['newEvents']): CareerResponse => ({
    career: { ...career, newEvents: events },
    round: null,
  });

  test('the events fired by an action are queued and dismissed one by one', async () => {
    vi.mocked(api.restCareer).mockResolvedValue(
      withEvents([
        { id: 1, text: 'Énergie +2' },
        { id: 2, text: 'Carnet +1' },
      ]),
    );
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.rest();
    });
    expect(result.current.events.map((event) => event.id)).toEqual([1, 2]);

    act(() => result.current.dismissEvent());
    expect(result.current.events.map((event) => event.id)).toEqual([2]);
  });

  test('the events of the last track of a sortie come with the guess result', async () => {
    vi.mocked(api.studyCareer).mockResolvedValue(studyRound);
    vi.mocked(api.submitGuess).mockResolvedValue({
      correct: true,
      state: { ...playing, status: 'won' },
      career: { ...career, newEvents: [{ id: 6, text: 'Culture +100' }] },
    });
    const { result } = renderHook(() => useCareer());
    await act(async () => {
      await result.current.study('oreille');
    });

    await act(async () => {
      await result.current.guess('Dream with You');
    });

    expect(result.current.events).toEqual([{ id: 6, text: 'Culture +100' }]);
  });

  test('entering the career again does not replay the events already seen', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue(withEvents([{ id: 1, text: 'Énergie +2' }]));
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.enter();
    });

    expect(result.current.events).toEqual([]);
  });

  test('chooseReward() sends the option and queues the resulting event', async () => {
    vi.mocked(api.chooseCareerReward).mockResolvedValue(withEvents([{ id: 10, text: 'Série ! Énergie +4' }]));
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.chooseReward('energy');
    });

    expect(api.chooseCareerReward).toHaveBeenCalledWith('energy');
    expect(result.current.events).toEqual([{ id: 10, text: 'Série ! Énergie +4' }]);
  });

  test('finale() starts the finale round', async () => {
    vi.mocked(api.finaleCareer).mockResolvedValue({
      career,
      round: { kind: 'finale', stat: null, inNotebook: false, state: playing },
    });
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.finale();
    });

    expect(result.current.round?.kind).toBe('finale');
  });

  test('a refused action reports why it is blocked by a pending choice', async () => {
    vi.mocked(api.restCareer).mockRejectedValue(new ApiError('EVENT_PENDING'));
    const { result } = renderHook(() => useCareer());

    await act(async () => {
      await result.current.rest();
    });

    expect(result.current.error).toBe('Choisir une récompense avant de continuer.');
  });
});
