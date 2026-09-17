import type { RefObject } from 'react';

interface PlayerProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  allowedSeconds: number;
  progress: number;
  disabled: boolean;
  volume: number;
  onPlay: () => void;
  onEnded: () => void;
  onVolumeChange: (volume: number) => void;
}

function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `0:${String(s).padStart(2, '0')}`;
}

export default function Player({
  audioRef,
  allowedSeconds,
  progress,
  disabled,
  volume,
  onPlay,
  onEnded,
  onVolumeChange,
}: PlayerProps) {
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
      <input
        type="range"
        className="volume-slider"
        aria-label="Volume"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
      />
      <audio ref={audioRef} onEnded={onEnded} preload="none" />
    </section>
  );
}
