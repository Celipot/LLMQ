import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Player from './Player';

function renderPlayer(overrides: Partial<Parameters<typeof Player>[0]> = {}) {
  const props = {
    audioRef: createRef<HTMLAudioElement>(),
    allowedSeconds: 1,
    progress: 0,
    disabled: false,
    volume: 1,
    isPlaying: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onAudioPlay: vi.fn(),
    onAudioPause: vi.fn(),
    onEnded: vi.fn(),
    onVolumeChange: vi.fn(),
    ...overrides,
  };
  render(<Player {...props} />);
  return props;
}

describe('Player', () => {
  test('offers to listen while nothing is playing', async () => {
    const props = renderPlayer({ isPlaying: false });

    await userEvent.click(screen.getByRole('button', { name: 'Écouter' }));

    expect(props.onPlay).toHaveBeenCalledTimes(1);
  });

  test('turns the same button into a pause button while playing', async () => {
    const props = renderPlayer({ isPlaying: true });

    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(props.onPause).toHaveBeenCalledTimes(1);
    expect(props.onPlay).not.toHaveBeenCalled();
  });
});
