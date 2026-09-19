import { useEffect, useRef, useState } from 'react';
import { ApiError, startMultiplayerGame, updateSongCount, updateAnswerWindow } from '../api';
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
  maxStage: number;
  durationSeconds: number;
  // Preview of the next stage's clip length, or null at the last stage of a
  // song (there is no next stage within it — the song ends there instead).
  nextDurationSeconds: number | null;
  answerWindowMs: number;
  // Client-captured Date.now() when this StageInfo was set, not a value from
  // the server — see GamePlay's countdown: it avoids needing a clock-sync
  // handshake (an unconfirmed spike in the epic doc) since a UI countdown
  // only needs to be accurate to about a second, not audio-sync precision.
  startedAt: number;
}

interface GameResultData {
  song: GameEndedSong;
  players: GameEndedPlayer[];
}

const DEFAULT_SONG_COUNT = 1;
const MIN_SONG_COUNT = 1;
const MAX_SONG_COUNT = 100;

const DEFAULT_ANSWER_WINDOW_SECONDS = 60;
const MIN_ANSWER_WINDOW_SECONDS = 10;
const MAX_ANSWER_WINDOW_SECONDS = 300;

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
  const [songCount, setSongCount] = useState(DEFAULT_SONG_COUNT);
  const [songCountError, setSongCountError] = useState<string | null>(null);
  const [answerWindowSeconds, setAnswerWindowSeconds] = useState(DEFAULT_ANSWER_WINDOW_SECONDS);
  const [answerWindowError, setAnswerWindowError] = useState<string | null>(null);
  const [songIndex, setSongIndex] = useState(1);
  // Every song played so far this game, appended to on each `song:ended` —
  // this persists for the whole game so the sidebar history keeps growing.
  const [songHistory, setSongHistory] = useState<GameEndedSong[]>([]);
  // Running total per player, updated at the end of each song (backlog:
  // "afficher le score au fur et à mesure"). Keyed by playerId rather than
  // kept on MultiplayerPlayer itself since it only exists once at least one
  // song has finished, and needs to survive that player's status resetting
  // back to "active" for the next song.
  const [scores, setScores] = useState<Record<string, number>>({});
  const [answerPending, setAnswerPending] = useState(false);
  const [forfeitPending, setForfeitPending] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const [isHost, setIsHost] = useState(() => localStorage.getItem(`hostToken:${gameId}`) !== null);

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
        // for 60s (lobby and in-game alike) — after that the reconnect gets 4004.
        retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    function handleMessage(event: MessageEvent) {
      const message = JSON.parse(event.data as string);
      if (message.type === 'lobby:state') {
        setPlayers(message.players);
        if (typeof message.songCount === 'number') setSongCount(message.songCount);
        if (typeof message.answerWindowSeconds === 'number') setAnswerWindowSeconds(message.answerWindowSeconds);
      } else if (message.type === 'lobby:songCount') {
        setSongCount(message.songCount);
      } else if (message.type === 'lobby:answerWindow') {
        setAnswerWindowSeconds(message.answerWindowSeconds);
      } else if (message.type === 'game:state') {
        // Full resync after a reconnect mid-game (backlog MP-13).
        setPlayers(message.players);
        if (typeof message.songCount === 'number') setSongCount(message.songCount);
        if (typeof message.songIndex === 'number') setSongIndex(message.songIndex);
        // The server is authoritative for what was missed while offline (or
        // lost on a page reload), so this replaces local history and scores.
        if (Array.isArray(message.playedSongs)) setSongHistory(message.playedSongs);
        setScores(
          Object.fromEntries(
            (message.players as MultiplayerPlayer[])
              .filter((p): p is MultiplayerPlayer & { totalScore: number } => p.totalScore !== undefined)
              .map((p) => [p.playerId, p.totalScore])
          )
        );
        if (message.status === 'in_progress') {
          // On resync, the server already knows how much of the answer
          // window is left (remainingMs) — seed the local countdown with
          // that instead of a fresh full window.
          setStageInfo({
            stage: message.stage,
            maxStage: message.maxStage,
            durationSeconds: message.durationSeconds,
            nextDurationSeconds: message.nextDurationSeconds ?? null,
            answerWindowMs: message.remainingMs,
            startedAt: Date.now(),
          });
          const own = message.players.find((p: MultiplayerPlayer) => p.playerId === playerId);
          setForfeited(own?.status === 'forfeited');
          setAnswerFeedback(
            own?.status === 'found' ? { correct: true } : own?.forfeitReason === 'wrong' ? { correct: false } : null
          );
          setAnswerPending(false);
          setForfeitPending(false);
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
        setStageInfo({
          stage: message.stage,
          maxStage: message.maxStage,
          durationSeconds: message.durationSeconds,
          nextDurationSeconds: message.nextDurationSeconds ?? null,
          answerWindowMs: message.answerWindowMs,
          startedAt: Date.now(),
        });
        if (typeof message.songIndex === 'number') setSongIndex(message.songIndex);
        if (typeof message.songCount === 'number') setSongCount(message.songCount);
        // "found" locks the controls for the whole song (the server refuses any
        // further answer), so only a new song or a wrong guess is cleared.
        const isNewSong = message.stage === 1;
        setAnswerFeedback((prev) => (prev?.correct === true && !isNewSong ? prev : null));
        setForfeited(false);
        // A new stage moots any in-flight submit/forfeit for the previous
        // one — the server has already moved on.
        setAnswerPending(false);
        setForfeitPending(false);
        // A straggler who never clicked "Retour au lobby" must not stay
        // stuck on the old results screen once a new round actually starts.
        setGameResult(null);
        // "found" is permanent for the whole song — only forfeited players
        // get another try once the stage advances (see server-side
        // multiplayerGames.checkStageProgress for the matching rule).
        // stage === 1 marks a song boundary (game start or the next song
        // after song:ended), where the server also resets "found" players
        // back to active — mirror that here too.
        setPlayers((prev) =>
          prev.map((player) =>
            player.status === 'forfeited' || (isNewSong && player.status === 'found')
              ? { ...player, status: 'active', forfeitReason: undefined }
              : player
          )
        );
      } else if (message.type === 'song:ended') {
        setSongHistory((prev) => [...prev, message.song]);
        setScores((prev) => {
          const next = { ...prev };
          for (const player of message.players as GameEndedPlayer[]) {
            next[player.playerId] = player.totalScore ?? 0;
          }
          return next;
        });
      } else if (message.type === 'game:ended') {
        setGameResult({ song: message.song, players: message.players });
      } else if (message.type === 'game:reset') {
        // Broadcast to everyone whenever any player confirms "Retour au
        // lobby" — only refreshes the shared player list (so those already
        // in the lobby see who's still waiting). It does NOT navigate
        // anyone away from their results screen; only clicking your own
        // button does that (see confirmReturnToLobby below).
        setPlayers(message.players);
        if (typeof message.songCount === 'number') setSongCount(message.songCount);
        if (typeof message.answerWindowSeconds === 'number') setAnswerWindowSeconds(message.answerWindowSeconds);
        setSongIndex(1);
        setScores({});
        setSongHistory([]);
        // Without this, the last game's stale stageInfo/started stay truthy
        // and the render logic (gameResult -> stageInfo -> started -> lobby)
        // falls straight back into GamePlay instead of the lobby screen —
        // "Retour au lobby" would appear to relaunch the game immediately.
        setStageInfo(null);
        setStarted(false);
      } else if (message.type === 'answer:result' && typeof message.correct === 'boolean') {
        setAnswerPending(false);
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
          prev.map((player) =>
            player.playerId === message.playerId
              ? { ...player, status: message.status, forfeitReason: message.reason }
              : player
          )
        );
        if (message.playerId === playerId && message.status === 'forfeited') {
          setForfeited(true);
          setForfeitPending(false);
        }
      } else if (message.type === 'stage:forfeit:error') {
        setForfeitPending(false);
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
      } else if (message.type === 'host:transferred') {
        localStorage.setItem(`hostToken:${gameId}`, message.hostToken);
        setIsHost(true);
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
    setAnswerPending(true);
    socketRef.current?.send(JSON.stringify({ type: 'answer:submit', value: title }));
  }

  function forfeitStage() {
    setForfeitPending(true);
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

  async function handleSongCountChange(value: number) {
    const hostToken = localStorage.getItem(`hostToken:${gameId}`);
    if (!hostToken || Number.isNaN(value)) return;
    const clamped = Math.min(MAX_SONG_COUNT, Math.max(MIN_SONG_COUNT, Math.round(value)));
    setSongCount(clamped);
    setSongCountError(null);
    try {
      await updateSongCount(gameId, hostToken, clamped);
    } catch {
      setSongCountError('Impossible de mettre à jour le nombre de musiques.');
    }
  }

  async function handleAnswerWindowChange(value: number) {
    const hostToken = localStorage.getItem(`hostToken:${gameId}`);
    if (!hostToken || Number.isNaN(value)) return;
    const clamped = Math.min(MAX_ANSWER_WINDOW_SECONDS, Math.max(MIN_ANSWER_WINDOW_SECONDS, Math.round(value)));
    setAnswerWindowSeconds(clamped);
    setAnswerWindowError(null);
    try {
      await updateAnswerWindow(gameId, hostToken, clamped);
    } catch {
      setAnswerWindowError('Impossible de mettre à jour le temps pour deviner.');
    }
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
        maxStage={stageInfo.maxStage}
        durationSeconds={stageInfo.durationSeconds}
        nextDurationSeconds={stageInfo.nextDurationSeconds}
        answerWindowMs={stageInfo.answerWindowMs}
        startedAt={stageInfo.startedAt}
        songIndex={songIndex}
        songCount={songCount}
        scores={scores}
        onSubmitAnswer={submitAnswer}
        answerFeedback={answerFeedback}
        forfeited={forfeited}
        onForfeit={forfeitStage}
        answerPending={answerPending}
        forfeitPending={forfeitPending}
        players={players}
        songHistory={songHistory}
      />
    );
  }

  if (started) {
    return <p className="subtitle">La partie démarre...</p>;
  }

  return (
    <section className="lobby">
      <p className="subtitle">En attente du lancement de la partie...</p>
      <div className="song-count-setting">
        {isHost ? (
          <label>
            Nombre de musiques
            <input
              type="number"
              min={MIN_SONG_COUNT}
              max={MAX_SONG_COUNT}
              value={songCount}
              onChange={(event) => handleSongCountChange(Number(event.target.value))}
            />
          </label>
        ) : (
          <p>Nombre de musiques : {songCount}</p>
        )}
        {songCountError && (
          <p className="error-msg" role="alert">
            {songCountError}
          </p>
        )}
      </div>
      <div className="answer-window-setting">
        {isHost ? (
          <label>
            Temps pour deviner : {answerWindowSeconds}s
            <input
              type="range"
              min={MIN_ANSWER_WINDOW_SECONDS}
              max={MAX_ANSWER_WINDOW_SECONDS}
              value={answerWindowSeconds}
              onChange={(event) => handleAnswerWindowChange(Number(event.target.value))}
            />
          </label>
        ) : (
          <p>Temps pour deviner : {answerWindowSeconds}s</p>
        )}
        {answerWindowError && (
          <p className="error-msg" role="alert">
            {answerWindowError}
          </p>
        )}
      </div>
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
