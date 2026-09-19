import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NOTICE_DURATION_MS, useStageChangeNotice } from './useStageChangeNotice';

interface Props {
  songIndex: number;
  stage: number;
}

function setup(initial: Props) {
  return renderHook(
    ({ songIndex, stage }: Props) =>
      useStageChangeNotice({ songIndex, songCount: 5, stage, maxStage: 6, durationSeconds: 4 }),
    { initialProps: initial }
  );
}

describe('useStageChangeNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('announces a new song on the first stage of a song at mount', () => {
    const { result } = setup({ songIndex: 1, stage: 1 });

    expect(result.current).toMatchObject({ kind: 'song', songIndex: 1, songCount: 5 });
  });

  test('announces nothing when mounting mid-song', () => {
    const { result } = setup({ songIndex: 2, stage: 3 });

    expect(result.current).toBeNull();
  });

  test('announces a new stage when only the stage changes', () => {
    const { result, rerender } = setup({ songIndex: 2, stage: 3 });

    rerender({ songIndex: 2, stage: 4 });

    expect(result.current).toMatchObject({ kind: 'stage', stage: 4, maxStage: 6, durationSeconds: 4 });
  });

  test('announces a new song when the song index changes', () => {
    const { result, rerender } = setup({ songIndex: 2, stage: 3 });

    rerender({ songIndex: 3, stage: 1 });

    expect(result.current).toMatchObject({ kind: 'song', songIndex: 3 });
  });

  test('announces nothing when neither the song nor the stage changed', () => {
    const { result, rerender } = setup({ songIndex: 2, stage: 3 });

    rerender({ songIndex: 2, stage: 3 });

    expect(result.current).toBeNull();
  });

  test('clears the notice once its duration has elapsed', () => {
    const { result, rerender } = setup({ songIndex: 2, stage: 3 });
    rerender({ songIndex: 2, stage: 4 });

    act(() => {
      vi.advanceTimersByTime(NOTICE_DURATION_MS);
    });

    expect(result.current).toBeNull();
  });

  test('a newer change replaces the notice and restarts the clock', () => {
    const { result, rerender } = setup({ songIndex: 2, stage: 3 });
    rerender({ songIndex: 2, stage: 4 });
    act(() => {
      vi.advanceTimersByTime(NOTICE_DURATION_MS - 100);
    });

    rerender({ songIndex: 2, stage: 5 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toMatchObject({ kind: 'stage', stage: 5 });
  });
});
