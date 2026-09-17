import { useCallback, useEffect, useState } from 'react';
import Player from './Player';
import SearchAutocomplete from './SearchAutocomplete';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { fetchTitles, multiplayerAudioTrackUrl } from '../api';
import type { AnswerFeedback, PlayableSong } from '../types';

interface GamePlayProps {
  gameId: string;
  stage: number;
  durationSeconds: number;
  onSubmitAnswer: (title: string) => void;
  answerFeedback: AnswerFeedback | null;
}

export default function GamePlay({ gameId, stage, durationSeconds, onSubmitAnswer, answerFeedback }: GamePlayProps) {
  const [titles, setTitles] = useState<PlayableSong[]>([]);
  const [inputValue, setInputValue] = useState('');
  const found = answerFeedback?.correct === true;

  useEffect(() => {
    fetchTitles()
      .then(setTitles)
      .catch(() => {});
  }, []);

  const getTrackUrl = useCallback(() => multiplayerAudioTrackUrl(gameId), [gameId]);
  const { audioRef, progress, playError, volume, play, handleEnded, setVolume } = useAudioPlayer(
    durationSeconds,
    getTrackUrl
  );

  function handleSubmit() {
    if (inputValue.trim() === '' || found) return;
    onSubmitAnswer(inputValue.trim());
    setInputValue('');
  }

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
      <section className="search-section">
        <SearchAutocomplete titles={titles} value={inputValue} disabled={found} onChange={setInputValue} onSubmit={handleSubmit} />
        <div className="actions">
          <button type="button" disabled={found} onClick={handleSubmit}>
            Valider
          </button>
        </div>
      </section>
      {playError && (
        <p className="error-msg" role="alert">
          {playError}
        </p>
      )}
      {answerFeedback && (
        <p className={found ? 'success-msg' : 'error-msg'} role={found ? 'status' : 'alert'}>
          {found ? 'Bravo, tu as trouvé !' : "Ce n'est pas ça, retente ta chance."}
        </p>
      )}
    </section>
  );
}
