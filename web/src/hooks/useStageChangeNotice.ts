import { useEffect, useState } from 'react';

export const NOTICE_DURATION_MS = 2500;

export interface StageChangeNotice {
  kind: 'song' | 'stage';
  songIndex: number;
  songCount: number;
  stage: number;
  maxStage: number;
  durationSeconds: number;
}

type Position = Omit<StageChangeNotice, 'kind'>;

// Stage 1 is always a song boundary, so mounting there (game start) announces
// the song; mounting mid-song (reconnect resync) stays silent.
export function useStageChangeNotice(position: Position): StageChangeNotice | null {
  const key = `${position.songIndex}:${position.stage}`;
  const [prevKey, setPrevKey] = useState(key);
  const [prevSongIndex, setPrevSongIndex] = useState(position.songIndex);
  const [notice, setNotice] = useState<StageChangeNotice | null>(
    position.stage === 1 ? { kind: 'song', ...position } : null
  );

  // Adjusting state when a prop changes (same pattern as GamePlay's startedAt)
  // so the notice shows in the very render where the stage changed.
  if (key !== prevKey) {
    setPrevKey(key);
    setPrevSongIndex(position.songIndex);
    setNotice({ kind: position.songIndex !== prevSongIndex ? 'song' : 'stage', ...position });
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return notice;
}
