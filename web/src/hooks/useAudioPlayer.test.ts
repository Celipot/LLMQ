import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAudioPlayer } from './useAudioPlayer';

function setup(initialSeconds = 1) {
  const getTrackUrl = vi.fn(() => '/track');
  const hook = renderHook(({ seconds }) => useAudioPlayer(seconds, getTrackUrl), {
    initialProps: { seconds: initialSeconds },
  });
  hook.result.current.audioRef.current = document.createElement('audio');
  return { ...hook, getTrackUrl };
}

describe('useAudioPlayer', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('pause pauses the audio element', async () => {
    const { result } = setup();
    await act(() => result.current.play());

    act(() => result.current.pause());

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  });

  test('play after a pause resumes without re-fetching the track', async () => {
    const { result, getTrackUrl } = setup();
    await act(() => result.current.play());
    act(() => result.current.pause());

    await act(() => result.current.play());

    expect(getTrackUrl).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });

  test('play after the track ended re-fetches the track', async () => {
    const { result, getTrackUrl } = setup();
    await act(() => result.current.play());
    act(() => result.current.handleEnded());

    await act(() => result.current.play());

    expect(getTrackUrl).toHaveBeenCalledTimes(2);
  });

  test('play after a pause re-fetches once the allowed duration changed', async () => {
    const { result, rerender, getTrackUrl } = setup(1);
    await act(() => result.current.play());
    act(() => result.current.pause());
    rerender({ seconds: 2 });

    await act(() => result.current.play());

    expect(getTrackUrl).toHaveBeenCalledTimes(2);
  });

  test('isPlaying follows the audio element play and pause events', () => {
    const { result } = setup();
    expect(result.current.isPlaying).toBe(false);

    act(() => result.current.handleAudioPlay());
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.handleAudioPause());
    expect(result.current.isPlaying).toBe(false);
  });

  // The <audio> is unmounted with the round's Player while it plays, so no
  // pause event ever clears isPlaying: the next round's button would stay on "Pause".
  test('resetProgress clears isPlaying left over from an unmounted audio element', () => {
    const { result } = setup();
    act(() => result.current.handleAudioPlay());

    act(() => result.current.resetProgress());

    expect(result.current.isPlaying).toBe(false);
  });
});
