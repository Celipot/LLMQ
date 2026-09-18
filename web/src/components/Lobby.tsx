import { useEffect, useRef, useState } from 'react';
import { ApiError, startMultiplayerGame } from '../api';
import type { AnswerFeedback, GameEndedPlayer, GameEndedSong, MultiplayerPlayer } from '../types';
import GamePlay from './GamePlay';
import GameResult from './GameResult';

interface LobbyProps {
  gameId: string;
  playerId: string;
  onSessionInvalid: () => void;
  onLeave: () => void;
}

interface StageInfo {
  stage: number;
  durationSeconds: number;
}

interface GameResultData {
  song: GameEndedSong;
  players: GameEndedPlayer[];
}

// Solo testing/practice is allowed: the host alone is enough to start.
// Kept as a named constant since the backlog (MP-03 note technique) flagged
// this threshold as configurable, even though nothing else reads it.
const MIN_PLAYERS_TO_START = 1;

// The 60s server-side disconnect grace (backlog MP-13) is what actually
// bounds reconnection; this is just how often the client retries within it.
const RECONNECT_DELAY_MS = 2000;

export default function Lobby({ gameId, playerId, onSessionInvalid, onLeave }: LobbyProps) {
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [started, setStarted] = useState(false);
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const [forfeited, setForfeited] = useState(false);
  const [gameResult, setGameResult] = useState<GameResultData | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [kickError, setKickError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const isHost = localStorage.getItem(`hostToken:${gameId}`) !== null;

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/ws?gameId=${gameId}&playerId=${playerId}`);
      socketRef.current = socket;

      socket.onmessage = handleMessage;
      socket.onclose = (event) => {
        if (cancelled) return;
        socketRef.current = null;
        if (event.code === 4004) {
          onSessionInvalid();
          return;
        }
        // Not a deliberate unmount and not a rejected session — the drop was
        // a network blip; keep retrying, the server holds the player's slot
        // for 60s (backlog MP-13) regardless of how long this takes.
        retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    function handleMessage(event: MessageEvent) {
      const message = JSON.parse(event.data as string);
      if (message.type === 'lobby:state') {
        setPlayers(message.players);
      } else if (message.type === 'game:state') {
        // Full resync after a reconnect mid-game (backlog MP-13).
        setPlayers(message.players);
        if (message.status === 'in_progress') {
          setStageInfo({ stage: message.stage, durationSeconds: message.durationSeconds });
          const own = message.players.find((p: MultiplayerPlayer) => p.playerId === playerId);
          setForfeited(own?.status === 'forfeited');
          setAnswerFeedback(own?.status === 'found' ? { correct: true } : null);
        }
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
        // A straggler who never clicked "Retour au lobby" must not stay
        // stuck on the old results screen once a new round actually starts.
        setGameResult(null);
        // "found" is permanent for the whole game — only forfeited players
        // get another try once the stage advances (see server-side
        // multiplayerGames.checkStageProgress for the matching rule).
        setPlayers((prev) =>
          prev.map((player) => (player.status === 'forfeited' ? { ...player, status: 'active' } : player))
        );
      } else if (message.type === 'game:ended') {
        setGameResult({ song: message.song, players: message.players });
      } else if (message.type === 'game:reset') {
        // Broadcast to everyone whenever any player confirms "Retour au
        // lobby" — only refreshes the shared player list (so those already
        // in the lobby see who's still waiting). It does NOT navigate
        // anyone away from their results screen; only clicking your own
        // button does that (see confirmReturnToLobby below).
        setPlayers(message.players);
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
      } else if (message.type === 'player:connection') {
        setPlayers((prev) =>
          prev.map((player) =>
            player.playerId === message.playerId ? { ...player, connected: message.connected } : player
          )
        );
      } else if (message.type === 'player:kicked') {
        onLeave();
      } else if (message.type === 'player:kick:error') {
        setKickError('Impossible de retirer ce joueur.');
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
      socketRef.current = null;
    };
  }, [gameId, playerId, onSessionInvalid, onLeave]);

  function submitAnswer(title: string) {
    setAnswerFeedback(null);
    socketRef.current?.send(JSON.stringify({ type: 'answer:submit', value: title }));
  }

  function forfeitStage() {
    socketRef.current?.send(JSON.stringify({ type: 'stage:forfeit' }));
  }

  function leaveGame() {
    socketRef.current?.send(JSON.stringify({ type: 'player:leave' }));
    onLeave();
  }

  function kickPlayer(targetPlayerId: string) {
    const hostToken = localStorage.getItem(`hostToken:${gameId}`);
    if (!hostToken) return;
    setKickError(null);
    socketRef.current?.send(JSON.stringify({ type: 'player:kick', hostToken, targetPlayerId }));
  }

  function confirmReturnToLobby() {
    socketRef.current?.send(JSON.stringify({ type: 'player:returnToLobby' }));
    // Only this client navigates — others stay on their own results screen
    // until they click their own button (see the game:reset handler above).
    setGameResult(null);
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
    return (
      <>
        <GameResult song={gameResult.song} players={gameResult.players} />
        <button type="button" onClick={confirmReturnToLobby}>
          Retour au lobby
        </button>
      </>
    );
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
        onLeave={leaveGame}
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
          <li key={player.playerId}>
            {player.nickname}
            {player.returnedToLobby === false && <span className="player-waiting"> (en attente)</span>}
            {isHost && player.playerId !== playerId && (
              <button
                type="button"
                className="kick-button"
                aria-label={`Retirer ${player.nickname}`}
                onClick={() => kickPlayer(player.playerId)}
              >
                ✕
              </button>
            )}
          </li>
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
          {kickError && (
            <p className="error-msg" role="alert">
              {kickError}
            </p>
          )}
        </>
      )}
      <button type="button" className="secondary" onClick={leaveGame}>
        Quitter la partie
      </button>
    </section>
  );
}
