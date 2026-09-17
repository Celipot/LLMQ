import { useCallback, useRef, useState } from 'react';
import { audioTrackUrl } from '../api';

export function useAudioPlayer(allowedSeconds: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [playError, setPlayError] = useState<string | null>(null);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animate = useCallback(() => {
    stopAnimation();
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => {
      if (audio.paused || audio.ended) {
        rafRef.current = null;
        return;
      }
      setProgress(Math.min(100, (audio.currentTime / allowedSeconds) * 100));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [allowedSeconds, stopAnimation]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Always re-fetch: the server is the only source of truth for how much
    // audio is served, and the allowed duration may have changed.
    audio.src = audioTrackUrl();
    setProgress(0);
    try {
      await audio.play();
      animate();
      setPlayError(null);
    } catch {
      setPlayError("Impossible de lire l'audio.");
    }
  }, [animate]);

  const handleEnded = useCallback(() => {
    stopAnimation();
    setProgress(100);
  }, [stopAnimation]);

  const resetProgress = useCallback(() => {
    stopAnimation();
    setProgress(0);
  }, [stopAnimation]);

  return { audioRef, progress, playError, play, handleEnded, resetProgress };
}
