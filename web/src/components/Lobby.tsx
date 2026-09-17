import { useEffect, useState } from 'react';
import type { MultiplayerPlayer } from '../types';

interface LobbyProps {
  gameId: string;
  playerId: string;
}

// "désactivé si moins de 1 autre joueur" (backlog MP-03) = host + at least
// one other player, i.e. 2 total. Kept as a constant rather than a config UI:
// no other value is used anywhere yet.
const MIN_PLAYERS_TO_START = 2;

export default function Lobby({ gameId, playerId }: LobbyProps) {
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
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
      }
    };

    return () => socket.close();
  }, [gameId, playerId]);

  return (
    <section className="lobby">
      <p className="subtitle">En attente du lancement de la partie...</p>
      <ul className="lobby-players">
        {players.map((player) => (
          <li key={player.playerId}>{player.nickname}</li>
        ))}
      </ul>
      {isHost && (
        <button type="button" disabled={players.length < MIN_PLAYERS_TO_START}>
          Lancer la partie
        </button>
      )}
    </section>
  );
}
