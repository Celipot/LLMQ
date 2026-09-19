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
    releaseCareer: vi.fn(),
    submitGuess: vi.fn(),
    submitSkip: vi.fn(),
  };
});

const career: Career = {
  turn: 1,
  totalTurns: 10,
  energy: 3,
  maxEnergy: 3,
  stats: { oreille: 0, memoire: 0, culture: 0 },
  suggestionCount: 1,
  notebook: [],
  releaseDue: false,
  release: null,
};

const playing: GameState = { attemptsUsed: 0, maxAttempts: 3, allowedSeconds: 1, status: 'playing', guesses: [] };
const studyRound: CareerResponse = { career, round: { kind: 'study', stat: 'oreille', state: playing } };

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

    expect(result.current.error).toBe("Pas assez d'énergie pour étudier : il faut se reposer.");
    expect(result.current.career).toEqual(career);
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
