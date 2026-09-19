import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useProfile } from './useProfile';
import { resizeImageToDataUrl } from '../imageResize';

vi.mock('../imageResize', () => ({ resizeImageToDataUrl: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(resizeImageToDataUrl).mockReset();
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

  describe('avatar', () => {
    const file = new File(['x'], 'me.png', { type: 'image/png' });

    test('chooseAvatar stores the resized picture in the profile and persists it', async () => {
      vi.mocked(resizeImageToDataUrl).mockResolvedValue('data:image/jpeg;base64,AAAA');
      const { result } = renderHook(() => useProfile());

      await act(async () => result.current.chooseAvatar(file));

      expect(result.current.profile.avatar).toBe('data:image/jpeg;base64,AAAA');
      expect(JSON.parse(localStorage.getItem('profile') ?? '{}').avatar).toBe('data:image/jpeg;base64,AAAA');
    });

    test('a picture that cannot be processed sets an error and keeps the previous one', async () => {
      vi.mocked(resizeImageToDataUrl).mockResolvedValueOnce('data:image/jpeg;base64,OLD');
      const { result } = renderHook(() => useProfile());
      await act(async () => result.current.chooseAvatar(file));

      vi.mocked(resizeImageToDataUrl).mockRejectedValueOnce(new Error('UNSUPPORTED_IMAGE_TYPE'));
      await act(async () => result.current.chooseAvatar(file));

      expect(result.current.profile.avatar).toBe('data:image/jpeg;base64,OLD');
      expect(result.current.avatarError).toMatch(/image/i);
    });

    test('removeAvatar forgets the picture', async () => {
      vi.mocked(resizeImageToDataUrl).mockResolvedValue('data:image/jpeg;base64,AAAA');
      const { result } = renderHook(() => useProfile());
      await act(async () => result.current.chooseAvatar(file));

      act(() => result.current.removeAvatar());

      expect(result.current.profile.avatar).toBeUndefined();
    });

    test('saving the username keeps the picture', async () => {
      vi.mocked(resizeImageToDataUrl).mockResolvedValue('data:image/jpeg;base64,AAAA');
      const { result } = renderHook(() => useProfile());
      await act(async () => result.current.chooseAvatar(file));

      act(() => result.current.saveUsername('Alice'));

      expect(result.current.profile.avatar).toBe('data:image/jpeg;base64,AAAA');
    });
  });
});
