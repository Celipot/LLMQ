import type { RefObject } from 'react';

interface PlayerProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  allowedSeconds: number;
  progress: number;
  disabled: boolean;
  onPlay: () => void;
  onEnded: () => void;
}

function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `0:${String(s).padStart(2, '0')}`;
}

export default function Player({ audioRef, allowedSeconds, progress, disabled, onPlay, onEnded }: PlayerProps) {
  return (
    <section className="player">
      <button
        type="button"
        className="play-btn"
        aria-label="Écouter"
        disabled={disabled}
        onClick={onPlay}
      >
        ▶
      </button>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="allowed-seconds">{formatSeconds(allowedSeconds)}</span>
      <audio ref={audioRef} onEnded={onEnded} preload="none" />
    </section>
  );
}
