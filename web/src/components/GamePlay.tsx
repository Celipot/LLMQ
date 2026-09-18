import { useCallback, useEffect, useState } from 'react';
import Player from './Player';
import SearchAutocomplete from './SearchAutocomplete';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { fetchTitles, multiplayerAudioTrackUrl } from '../api';
import type {
  AnswerFeedback,
  GameEndedPlayer,
  GameEndedSong,
  MultiplayerPlayer,
  PlayerStageStatus,
  PlayableSong,
} from '../types';

interface SongReveal {
  song: GameEndedSong;
  players: GameEndedPlayer[];
}

interface GamePlayProps {
  gameId: string;
  stage: number;
  durationSeconds: number;
  songIndex: number;
  songCount: number;
  songReveal: SongReveal | null;
  onSubmitAnswer: (title: string) => void;
  answerFeedback: AnswerFeedback | null;
  forfeited: boolean;
  onForfeit: () => void;
  players: MultiplayerPlayer[];
  onLeave: () => void;
}

const STATUS_LABEL: Record<PlayerStageStatus, string> = {
  active: 'cherche encore',
  found: 'a trouvé',
  forfeited: 'a abandonné',
};

export default function GamePlay({
  gameId,
  stage,
  durationSeconds,
  songIndex,
  songCount,
  songReveal,
  onSubmitAnswer,
  answerFeedback,
  forfeited,
  onForfeit,
  players,
  onLeave,
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
      <p className="subtitle">
        Musique {songIndex}/{songCount} — Étape {stage} — devine le titre à partir de l'intro
      </p>
      {songReveal && (
        <p className="song-reveal" role="status">
          Musique précédente : {songReveal.song.title} — {songReveal.song.artist}
        </p>
      )}
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
      <ul className="game-play-players">
        {players.map((player) => (
          <li key={player.playerId}>
            {player.nickname} — {STATUS_LABEL[player.status ?? 'active']}
            {player.connected === false && <span className="player-disconnected"> (déconnecté)</span>}
          </li>
        ))}
      </ul>
      <button type="button" className="secondary" onClick={onLeave}>
        Quitter la partie
      </button>
    </section>
  );
}
