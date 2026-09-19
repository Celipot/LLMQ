import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TOAST_DURATION_MS, useToast } from './useToast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToast', () => {
  test('has no message until one is shown', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.message).toBeNull();
  });

  test('shows the message, then hides it once the duration has elapsed', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.showToast('Historique effacé.'));
    expect(result.current.message).toBe('Historique effacé.');

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(result.current.message).toBe('Historique effacé.');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.message).toBeNull();
  });

  test('a new message replaces the current one and gets the full duration', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Premier'));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 500));

    act(() => result.current.showToast('Second'));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));

    expect(result.current.message).toBe('Second');
  });
});
