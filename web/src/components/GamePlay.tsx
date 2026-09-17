import { useCallback } from 'react';
import Player from './Player';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { multiplayerAudioTrackUrl } from '../api';

interface GamePlayProps {
  gameId: string;
  stage: number;
  durationSeconds: number;
}

export default function GamePlay({ gameId, stage, durationSeconds }: GamePlayProps) {
  const getTrackUrl = useCallback(() => multiplayerAudioTrackUrl(gameId), [gameId]);
  const { audioRef, progress, playError, volume, play, handleEnded, setVolume } = useAudioPlayer(
    durationSeconds,
    getTrackUrl
  );

  return (
    <section className="game-play">
      <p className="subtitle">Étape {stage} — devine le titre à partir de l'intro</p>
      <Player
        audioRef={audioRef}
        allowedSeconds={durationSeconds}
        progress={progress}
        disabled={false}
        volume={volume}
        onPlay={play}
        onEnded={handleEnded}
        onVolumeChange={setVolume}
      />
      {playError && (
        <p className="error-msg" role="alert">
          {playError}
        </p>
      )}
    </section>
  );
}
