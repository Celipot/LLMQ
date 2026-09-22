import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { useEnterKey } from './useEnterKey';

describe('useEnterKey', () => {
  test('calls the handler on Enter when enabled', async () => {
    const handler = vi.fn();
    renderHook(() => useEnterKey(true, handler));

    await userEvent.keyboard('{Enter}');

    expect(handler).toHaveBeenCalledOnce();
  });

  test('does nothing when disabled', async () => {
    const handler = vi.fn();
    renderHook(() => useEnterKey(false, handler));

    await userEvent.keyboard('{Enter}');

    expect(handler).not.toHaveBeenCalled();
  });

  test('ignores other keys', async () => {
    const handler = vi.fn();
    renderHook(() => useEnterKey(true, handler));

    await userEvent.keyboard('{Escape}');

    expect(handler).not.toHaveBeenCalled();
  });

  test('lets a focused button handle Enter natively instead of double-firing', async () => {
    const handler = vi.fn();
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    renderHook(() => useEnterKey(true, handler));

    await userEvent.keyboard('{Enter}');

    expect(handler).not.toHaveBeenCalled();
    button.remove();
  });
});
