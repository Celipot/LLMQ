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
  // Preview of the next stage's clip length, or null at the last stage of a
  // song (there is no next stage within it — the song ends there instead).
  nextDurationSeconds: number | null;
  answerWindowMs: number;
  // Date.now() at the moment this stage's countdown should start from —
  // changing this value (even if stage/answerWindowMs didn't) restarts the
  // countdown, which is what a mid-game reconnect resync needs.
  startedAt: number;
  songIndex: number;
  songCount: number;
  songReveal: SongReveal | null;
  // Running total per player, keyed by playerId. Only populated once a song
  // has finished (a player with no entry hasn't scored yet).
  scores: Record<string, number>;
  onSubmitAnswer: (title: string) => void;
  answerFeedback: AnswerFeedback | null;
  forfeited: boolean;
  onForfeit: () => void;
  answerPending: boolean;
  forfeitPending: boolean;
  players: MultiplayerPlayer[];
  onLeave: () => void;
}

const COUNTDOWN_TICK_MS = 250;

function formatRemainingSeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000));
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
  nextDurationSeconds,
  answerWindowMs,
  startedAt,
  songIndex,
  songCount,
  songReveal,
  scores,
  onSubmitAnswer,
  answerFeedback,
  forfeited,
  onForfeit,
  answerPending,
  forfeitPending,
  players,
  onLeave,
}: GamePlayProps) {
  const [titles, setTitles] = useState<PlayableSong[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [remainingMs, setRemainingMs] = useState(answerWindowMs);
  // React's "adjusting state when a prop changes" pattern: resets the
  // countdown to the full window the instant startedAt changes (new stage,
  // or a reconnect resync), within the same render — no extra effect
  // roundtrip, and no setState-during-effect lint warning.
  const [prevStartedAt, setPrevStartedAt] = useState(startedAt);
  if (startedAt !== prevStartedAt) {
    setPrevStartedAt(startedAt);
    setRemainingMs(answerWindowMs);
  }
  const found = answerFeedback?.correct === true;
  const locked = found || forfeited;
  const busy = answerPending || forfeitPending;

  useEffect(() => {
    fetchTitles()
      .then(setTitles)
      .catch(() => {});
  }, []);

  // Paced locally rather than off serverTimestamp: a UI countdown only needs
  // second-level accuracy, so it isn't worth the clock-sync handshake the
  // epic doc flags as an unconfirmed spike for audio playback.
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, answerWindowMs - (Date.now() - startedAt)));
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [answerWindowMs, startedAt]);

  const getTrackUrl = useCallback(() => multiplayerAudioTrackUrl(gameId), [gameId]);
  const { audioRef, progress, playError, volume, play, handleEnded, setVolume } = useAudioPlayer(
    durationSeconds,
    getTrackUrl
  );

  function handleSubmit() {
    if (inputValue.trim() === '' || locked || busy) return;
    onSubmitAnswer(inputValue.trim());
    setInputValue('');
  }

  return (
    <div className="game-layout">
      <aside className="stage-info">
        <p className="stage-info-song">
          Musique {songIndex}/{songCount}
        </p>
        <p className="stage-info-stage">
          <span>Étape {stage}</span>
          <span>{durationSeconds}s</span>
        </p>
        {nextDurationSeconds !== null && (
          <p className="stage-info-next-duration">({nextDurationSeconds}s)</p>
        )}
        <p className="stage-timer" role="timer">
          Temps restant : {formatRemainingSeconds(remainingMs)}s
        </p>
        {songReveal && (
          <p className="song-reveal" role="status">
            Musique précédente : {songReveal.song.title} — {songReveal.song.artist}
          </p>
        )}
      </aside>
      <section className="game-play">
        <p className="subtitle">devine le titre à partir de l'intro</p>
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
            disabled={locked || busy}
            onChange={setInputValue}
            onSubmit={handleSubmit}
          />
          <div className="actions">
            <button type="button" disabled={locked || busy} onClick={handleSubmit}>
              {answerPending ? 'Valider…' : 'Valider'}
            </button>
            <button type="button" className="secondary" disabled={locked || busy} onClick={onForfeit}>
              {forfeitPending ? 'Abandonner…' : 'Abandonner cette étape'}
            </button>
          </div>
          {busy && (
            <p className="pending-indicator" role="status">
              En attente du serveur…
            </p>
          )}
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
              {player.playerId in scores && (
                <span className="player-score">
                  {' '}
                  — {scores[player.playerId]} pt{scores[player.playerId] > 1 ? 's' : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
        <button type="button" className="secondary" onClick={onLeave}>
          Quitter la partie
        </button>
      </section>
    </div>
  );
}
