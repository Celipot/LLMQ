import { useEffect, useState } from 'react';
import { ApiError, startMultiplayerGame } from '../api';
import type { MultiplayerPlayer } from '../types';
import GamePlay from './GamePlay';

interface LobbyProps {
  gameId: string;
  playerId: string;
}

interface StageInfo {
  stage: number;
  durationSeconds: number;
}

// "désactivé si moins de 1 autre joueur" (backlog MP-03) = host + at least
// one other player, i.e. 2 total. Kept as a constant rather than a config UI:
// no other value is used anywhere yet.
const MIN_PLAYERS_TO_START = 2;

export default function Lobby({ gameId, playerId }: LobbyProps) {
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [started, setStarted] = useState(false);
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const isHost = localStorage.getItem(`hostToken:${gameId}`) !== null;

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?gameId=${gameId}&playerId=${playerId}`);

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data as string);
      if (message.type === 'lobby:state') {
        setPlayers(message.players);
      } else if (message.type === 'player:joined') {
        setPlayers((prev) => [...prev, message.player]);
      } else if (message.type === 'player:left') {
        setPlayers((prev) => prev.filter((player) => player.playerId !== message.playerId));
      } else if (message.type === 'game:started') {
        setStarted(true);
      } else if (message.type === 'stage:start') {
        setStageInfo({ stage: message.stage, durationSeconds: message.durationSeconds });
      }
    };

    return () => socket.close();
  }, [gameId, playerId]);

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

  if (stageInfo) {
    return <GamePlay gameId={gameId} stage={stageInfo.stage} durationSeconds={stageInfo.durationSeconds} />;
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
