import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useGameState } from './useGameState';
import * as api from '../api';
import { ApiError } from '../api';
import type { GameState } from '../types';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    fetchState: vi.fn(),
    fetchTitles: vi.fn(),
    submitGuess: vi.fn(),
    submitSkip: vi.fn(),
    resetGame: vi.fn(),
    startRandomMode: vi.fn(),
    selectSong: vi.fn(),
  };
});

const initialState: GameState = {
  attemptsUsed: 0,
  maxAttempts: 6,
  allowedSeconds: 1,
  status: 'playing',
  guesses: [],
};

const placeholderTitle = { id: 1, title: 'Placeholder Track', artist: 'LLMQ Dev', status: 'not_started' as const };

beforeEach(() => {
  vi.mocked(api.fetchState).mockResolvedValue(initialState);
  vi.mocked(api.fetchTitles).mockResolvedValue([placeholderTitle]);
});

describe('useGameState', () => {
  test('loads state and titles on mount', async () => {
    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());
    expect(result.current.state).toEqual(initialState);
    expect(result.current.titles).toEqual([placeholderTitle]);
  });

  test('guess() with an empty title sets an error without calling the API', async () => {
    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.guess('   ');
    });

    expect(result.current.error).toBe('Entrer un titre avant de valider.');
    expect(api.submitGuess).not.toHaveBeenCalled();
  });

  test('guess() updates state on success and clears prior error', async () => {
    const wonState: GameState = { ...initialState, attemptsUsed: 1, status: 'won', correctTitle: 'Placeholder Track' };
    vi.mocked(api.submitGuess).mockResolvedValue({ correct: true, state: wonState });

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.guess('Placeholder Track');
    });

    expect(result.current.state).toEqual(wonState);
    expect(result.current.error).toBeNull();
  });

  test('guess() surfaces a French message for UNKNOWN_TITLE', async () => {
    vi.mocked(api.submitGuess).mockRejectedValue(new ApiError('UNKNOWN_TITLE'));

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.guess('Not A Real Song');
    });

    expect(result.current.error).toBe('Ce titre ne fait pas partie des chansons jouables.');
  });

  test('skip() updates state from the response', async () => {
    const skippedState: GameState = {
      ...initialState,
      attemptsUsed: 1,
      allowedSeconds: 2,
      guesses: [{ type: 'skip', title: null, correct: null }],
    };
    vi.mocked(api.submitSkip).mockResolvedValue({ state: skippedState });

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.skip();
    });

    expect(result.current.state).toEqual(skippedState);
  });

  test('reset() replaces state and clears error', async () => {
    vi.mocked(api.resetGame).mockResolvedValue(initialState);

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.state).toEqual(initialState);
    expect(result.current.error).toBeNull();
  });

  test('startRandom() replaces state and clears the active song id', async () => {
    const randomState: GameState = { ...initialState, attemptsUsed: 2 };
    vi.mocked(api.startRandomMode).mockResolvedValue(randomState);

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.selectSong(1);
    });
    await act(async () => {
      await result.current.startRandom();
    });

    expect(result.current.state).toEqual(randomState);
    expect(result.current.activeSongId).toBeNull();
  });

  test('startRandom(generations) forwards the chosen generations to the API', async () => {
    vi.mocked(api.startRandomMode).mockResolvedValue(initialState);

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.startRandom(['Aqours', 'Liella']);
    });

    expect(api.startRandomMode).toHaveBeenCalledWith(['Aqours', 'Liella'], undefined);
  });

  test('startRandom(generations, history) forwards the play history to the API', async () => {
    vi.mocked(api.startRandomMode).mockResolvedValue(initialState);
    const history = { 7: { plays: 2, wins: 1, stageSum: 3, lastPlayedAt: 1 } };

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.startRandom(['Aqours'], history);
    });

    expect(api.startRandomMode).toHaveBeenCalledWith(['Aqours'], history);
  });

  test('reset(history) forwards the play history to the API', async () => {
    vi.mocked(api.resetGame).mockResolvedValue(initialState);
    const history = { 7: { plays: 2, wins: 1, stageSum: 3, lastPlayedAt: 1 } };

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.reset(history);
    });

    expect(api.resetGame).toHaveBeenCalledWith(history);
  });

  test('finding the song of a Random round reports the song id, the win and the stage', async () => {
    const onRoundFinished = vi.fn();
    const wonState: GameState = { ...initialState, attemptsUsed: 3, status: 'won', correctSongId: 5 };
    vi.mocked(api.submitGuess).mockResolvedValue({ correct: true, state: wonState });

    const { result } = renderHook(() => useGameState(onRoundFinished));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.guess('Placeholder Track');
    });

    expect(onRoundFinished).toHaveBeenCalledWith({ songId: 5, won: true, stage: 3 });
  });

  test('losing a Random round reports a loss', async () => {
    const onRoundFinished = vi.fn();
    const lostState: GameState = { ...initialState, attemptsUsed: 6, status: 'lost', correctSongId: 5 };
    vi.mocked(api.submitSkip).mockResolvedValue({ state: lostState });

    const { result } = renderHook(() => useGameState(onRoundFinished));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.skip();
    });

    expect(onRoundFinished).toHaveBeenCalledWith({ songId: 5, won: false, stage: 6 });
  });

  test('a round still being played is not reported', async () => {
    const onRoundFinished = vi.fn();
    vi.mocked(api.submitGuess).mockResolvedValue({
      correct: false,
      state: { ...initialState, attemptsUsed: 1 },
    });

    const { result } = renderHook(() => useGameState(onRoundFinished));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.guess('Wrong');
    });

    expect(onRoundFinished).not.toHaveBeenCalled();
  });

  test('a List mode round is not reported', async () => {
    const onRoundFinished = vi.fn();
    vi.mocked(api.selectSong).mockResolvedValue(initialState);
    vi.mocked(api.submitGuess).mockResolvedValue({
      correct: true,
      state: { ...initialState, attemptsUsed: 1, status: 'won', correctSongId: 1 },
    });

    const { result } = renderHook(() => useGameState(onRoundFinished));
    await waitFor(() => expect(result.current.state).not.toBeNull());
    await act(async () => {
      await result.current.selectSong(1);
    });

    await act(async () => {
      await result.current.guess('Placeholder Track');
    });

    expect(onRoundFinished).not.toHaveBeenCalled();
  });

  test('selectSong() replaces state, sets the active song id, and refreshes titles', async () => {
    const listState: GameState = { ...initialState, attemptsUsed: 1 };
    vi.mocked(api.selectSong).mockResolvedValue(listState);
    vi.mocked(api.fetchTitles).mockResolvedValue([placeholderTitle]);

    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.selectSong(1);
    });

    expect(api.selectSong).toHaveBeenCalledWith(1);
    expect(result.current.state).toEqual(listState);
    expect(result.current.activeSongId).toBe(1);
  });
});
