import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useSongHistory } from './useSongHistory';

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('useSongHistory', () => {
  test('starts with an empty history and the adaptive draw enabled', () => {
    const { result } = renderHook(() => useSongHistory());

    expect(result.current.history).toEqual({});
    expect(result.current.adaptive).toBe(true);
  });

  test('records a win with the stage it was found at', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const { result } = renderHook(() => useSongHistory());

    act(() => result.current.recordResult({ songId: 7, won: true, stage: 3 }));

    expect(result.current.history[7]).toEqual({ plays: 1, wins: 1, stageSum: 3, lastPlayedAt: 1_700_000_000_000 });
  });

  test('records a loss as a play without a win nor a stage', () => {
    const { result } = renderHook(() => useSongHistory());

    act(() => result.current.recordResult({ songId: 7, won: false, stage: 6 }));

    expect(result.current.history[7]).toMatchObject({ plays: 1, wins: 0, stageSum: 0 });
  });

  test('accumulates results for the same song', () => {
    const { result } = renderHook(() => useSongHistory());

    act(() => result.current.recordResult({ songId: 7, won: true, stage: 2 }));
    act(() => result.current.recordResult({ songId: 7, won: false, stage: 6 }));
    act(() => result.current.recordResult({ songId: 7, won: true, stage: 4 }));

    expect(result.current.history[7]).toMatchObject({ plays: 3, wins: 2, stageSum: 6 });
  });

  test('persists the history across mounts', () => {
    const first = renderHook(() => useSongHistory());
    act(() => first.result.current.recordResult({ songId: 7, won: true, stage: 1 }));
    first.unmount();

    const second = renderHook(() => useSongHistory());

    expect(second.result.current.history[7]).toMatchObject({ plays: 1, wins: 1, stageSum: 1 });
  });

  test('clearHistory forgets every result', () => {
    const { result } = renderHook(() => useSongHistory());
    act(() => result.current.recordResult({ songId: 7, won: true, stage: 1 }));

    act(() => result.current.clearHistory());

    expect(result.current.history).toEqual({});
    expect(renderHook(() => useSongHistory()).result.current.history).toEqual({});
  });

  test('persists the adaptive draw preference', () => {
    const first = renderHook(() => useSongHistory());
    act(() => first.result.current.setAdaptive(false));
    first.unmount();

    expect(renderHook(() => useSongHistory()).result.current.adaptive).toBe(false);
  });

  test('ignores a corrupted stored history', () => {
    localStorage.setItem('songHistory', '{not json');

    const { result } = renderHook(() => useSongHistory());

    expect(result.current.history).toEqual({});
  });
});
