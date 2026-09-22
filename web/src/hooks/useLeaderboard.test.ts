import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useLeaderboard } from './useLeaderboard';
import * as api from '../api';
import type { Leaderboards } from '../types';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, fetchLeaderboards: vi.fn() };
});

const emptyBoards: Leaderboards = { nijigasaki: [], mus: [], aqours: [], hasunosora: [], liella: [], ikizulive: [], all: [] };
const boards: Leaderboards = { ...emptyBoards, nijigasaki: [{ username: 'Ayumu', turn: 63, score: 18240, grade: 'A' as const }] };

beforeEach(() => {
  vi.mocked(api.fetchLeaderboards).mockReset();
});

describe('useLeaderboard', () => {
  test('exposes the boards returned by the server once enabled', async () => {
    vi.mocked(api.fetchLeaderboards).mockResolvedValue(boards);

    const { result } = renderHook(() => useLeaderboard(true));

    await waitFor(() => expect(result.current).toEqual(boards));
  });

  test('asks nothing while disabled', () => {
    renderHook(() => useLeaderboard(false));

    expect(api.fetchLeaderboards).not.toHaveBeenCalled();
  });

  test('asks again each time it is enabled', async () => {
    vi.mocked(api.fetchLeaderboards).mockResolvedValue(boards);

    const { rerender } = renderHook(({ enabled }) => useLeaderboard(enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(api.fetchLeaderboards).toHaveBeenCalledTimes(1));
    rerender({ enabled: false });
    rerender({ enabled: true });

    await waitFor(() => expect(api.fetchLeaderboards).toHaveBeenCalledTimes(2));
  });

  test('stays empty when the request fails', async () => {
    vi.mocked(api.fetchLeaderboards).mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useLeaderboard(true));

    await waitFor(() => expect(api.fetchLeaderboards).toHaveBeenCalled());
    expect(result.current).toEqual(emptyBoards);
  });
});
