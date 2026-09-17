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
  forfeited: boolean;
  onForfeit: () => void;
}

export default function GamePlay({
  gameId,
  stage,
  durationSeconds,
  onSubmitAnswer,
  answerFeedback,
  forfeited,
  onForfeit,
}: GamePlayProps) {
  const [titles, setTitles] = useState<PlayableSong[]>([]);
  const [inputValue, setInputValue] = useState('');
  const found = answerFeedback?.correct === true;
  const locked = found || forfeited;

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
    if (inputValue.trim() === '' || locked) return;
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
        <SearchAutocomplete
          titles={titles}
          value={inputValue}
          disabled={locked}
          onChange={setInputValue}
          onSubmit={handleSubmit}
        />
        <div className="actions">
          <button type="button" disabled={locked} onClick={handleSubmit}>
            Valider
          </button>
          <button type="button" className="secondary" disabled={locked} onClick={onForfeit}>
            Abandonner cette étape
          </button>
        </div>
      </section>
      {playError && (
        <p className="error-msg" role="alert">
          {playError}
        </p>
      )}
      {forfeited && <p className="subtitle">Tu as abandonné cette étape.</p>}
      {!forfeited && answerFeedback && (
        <p className={found ? 'success-msg' : 'error-msg'} role={found ? 'status' : 'alert'}>
          {found ? 'Bravo, tu as trouvé !' : "Ce n'est pas ça, retente ta chance."}
        </p>
      )}
    </section>
  );
}
