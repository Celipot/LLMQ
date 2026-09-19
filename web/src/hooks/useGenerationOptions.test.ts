import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useGenerationOptions } from './useGenerationOptions';
import * as api from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return { ...actual, fetchGenerations: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api.fetchGenerations).mockReset();
});

describe('useGenerationOptions', () => {
  test('exposes the generations returned by the server', async () => {
    const options = [
      { generation: 'Aqours', count: 189 },
      { generation: 'Liella', count: 145 },
    ];
    vi.mocked(api.fetchGenerations).mockResolvedValue(options);

    const { result } = renderHook(() => useGenerationOptions());

    await waitFor(() => expect(result.current).toEqual(options));
  });

  test('stays empty when the request fails', async () => {
    vi.mocked(api.fetchGenerations).mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useGenerationOptions());

    await waitFor(() => expect(api.fetchGenerations).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
