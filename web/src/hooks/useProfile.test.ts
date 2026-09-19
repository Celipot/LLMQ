import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { useProfile } from './useProfile';

beforeEach(() => {
  localStorage.clear();
});

describe('useProfile', () => {
  test('starts with an empty username', () => {
    const { result } = renderHook(() => useProfile());

    expect(result.current.profile.username).toBe('');
  });

  test('saves a trimmed username', () => {
    const { result } = renderHook(() => useProfile());

    act(() => result.current.saveUsername('  Alice  '));

    expect(result.current.profile.username).toBe('Alice');
  });

  test('keeps at most 20 characters', () => {
    const { result } = renderHook(() => useProfile());

    act(() => result.current.saveUsername('A'.repeat(30)));

    expect(result.current.profile.username).toBe('A'.repeat(20));
  });

  test('persists the profile across mounts', () => {
    const first = renderHook(() => useProfile());
    act(() => first.result.current.saveUsername('Alice'));
    first.unmount();

    expect(renderHook(() => useProfile()).result.current.profile.username).toBe('Alice');
  });

  test('ignores a corrupted stored profile', () => {
    localStorage.setItem('profile', '{not json');

    expect(renderHook(() => useProfile()).result.current.profile.username).toBe('');
  });
});
