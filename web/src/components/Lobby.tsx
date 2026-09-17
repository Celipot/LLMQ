import { useEffect, useRef, useState } from 'react';
import { ApiError, startMultiplayerGame } from '../api';
import type { AnswerFeedback, GameEndedPlayer, GameEndedSong, MultiplayerPlayer } from '../types';
import GamePlay from './GamePlay';
import GameResult from './GameResult';

interface LobbyProps {
  gameId: string;
  playerId: string;
}

interface StageInfo {
  stage: number;
  durationSeconds: number;
}

interface GameResultData {
  song: GameEndedSong;
  players: GameEndedPlayer[];
}

// "désactivé si moins de 1 autre joueur" (backlog MP-03) = host + at least
// one other player, i.e. 2 total. Kept as a constant rather than a config UI:
// no other value is used anywhere yet.
const MIN_PLAYERS_TO_START = 2;

export default function Lobby({ gameId, playerId }: LobbyProps) {
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [started, setStarted] = useState(false);
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const [forfeited, setForfeited] = useState(false);
  const [gameResult, setGameResult] = useState<GameResultData | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const isHost = localStorage.getItem(`hostToken:${gameId}`) !== null;

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?gameId=${gameId}&playerId=${playerId}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data as string);
      if (message.type === 'lobby:state') {
        setPlayers(message.players);
      } else if (message.type === 'player:joined') {
        // A reconnect (same playerId, new socket) re-triggers this event —
        // dedupe so the list never shows the same player twice.
        setPlayers((prev) =>
          prev.some((player) => player.playerId === message.player.playerId) ? prev : [...prev, message.player]
        );
      } else if (message.type === 'player:left') {
        setPlayers((prev) => prev.filter((player) => player.playerId !== message.playerId));
      } else if (message.type === 'game:started') {
        setStarted(true);
      } else if (message.type === 'stage:start') {
        setStageInfo({ stage: message.stage, durationSeconds: message.durationSeconds });
        setAnswerFeedback(null);
        setForfeited(false);
        // "found" is permanent for the whole game — only forfeited players
        // get another try once the stage advances (see server-side
        // multiplayerGames.checkStageProgress for the matching rule).
        setPlayers((prev) =>
          prev.map((player) => (player.status === 'forfeited' ? { ...player, status: 'active' } : player))
        );
      } else if (message.type === 'game:ended') {
        setGameResult({ song: message.song, players: message.players });
      } else if (message.type === 'answer:result' && typeof message.correct === 'boolean') {
        setAnswerFeedback({ correct: message.correct });
        // The server excludes the sender from the "found" broadcast (they
        // already have this ack) — reflect it in the shared list ourselves.
        if (message.correct) {
          setPlayers((prev) =>
            prev.map((player) => (player.playerId === playerId ? { ...player, status: 'found' } : player))
          );
        }
      } else if (message.type === 'player:status') {
        setPlayers((prev) =>
          prev.map((player) => (player.playerId === message.playerId ? { ...player, status: message.status } : player))
        );
        if (message.playerId === playerId && message.status === 'forfeited') {
          setForfeited(true);
        }
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [gameId, playerId]);

  function submitAnswer(title: string) {
    setAnswerFeedback(null);
    socketRef.current?.send(JSON.stringify({ type: 'answer:submit', value: title }));
  }

  function forfeitStage() {
    socketRef.current?.send(JSON.stringify({ type: 'stage:forfeit' }));
  }

  async function handleLaunch() {
    const hostToken = localStorage.getItem(`hostToken:${gameId}`);
    if (!hostToken) return;
    setLaunchError(null);
    setLaunching(true);
    try {
      await startMultiplayerGame(gameId, hostToken);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NOT_ENOUGH_PLAYERS') {
        setLaunchError('Il faut au moins un autre joueur pour lancer la partie.');
      } else {
        setLaunchError('Impossible de lancer la partie. Réessaie.');
      }
    } finally {
      setLaunching(false);
    }
  }

  if (gameResult) {
    return <GameResult song={gameResult.song} players={gameResult.players} />;
  }

  if (stageInfo) {
    return (
      <GamePlay
        gameId={gameId}
        stage={stageInfo.stage}
        durationSeconds={stageInfo.durationSeconds}
        onSubmitAnswer={submitAnswer}
        answerFeedback={answerFeedback}
        forfeited={forfeited}
        onForfeit={forfeitStage}
        players={players}
      />
    );
  }

  if (started) {
    return <p className="subtitle">La partie démarre...</p>;
  }

  return (
    <section className="lobby">
      <p className="subtitle">En attente du lancement de la partie...</p>
      <ul className="lobby-players">
        {players.map((player) => (
          <li key={player.playerId}>{player.nickname}</li>
        ))}
      </ul>
      {isHost && (
        <>
          <button type="button" disabled={players.length < MIN_PLAYERS_TO_START || launching} onClick={handleLaunch}>
            Lancer la partie
          </button>
          {launchError && (
            <p className="error-msg" role="alert">
              {launchError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
