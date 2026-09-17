// Realtime layer for multiplayer games (see prompt/user-stories-multiplayer.md
// §2 — WebSocket, server-authoritative). Kept separate from index.js/HTTP
// routes: this module only pushes lobby/game events over WS and reacts to
// disconnects, it never decides HTTP responses.

const { WebSocketServer } = require('ws');
const { URL } = require('url');
const multiplayerGames = require('./multiplayerGames');

// gameId -> Set<WebSocket>
const socketsByGame = new Map();

function socketsFor(gameId) {
  if (!socketsByGame.has(gameId)) {
    socketsByGame.set(gameId, new Set());
  }
  return socketsByGame.get(gameId);
}

function broadcast(gameId, message, exclude) {
  const payload = JSON.stringify(message);
  for (const socket of socketsFor(gameId)) {
    if (socket !== exclude && socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const { searchParams } = new URL(req.url, 'http://localhost');
    const gameId = searchParams.get('gameId');
    const playerId = searchParams.get('playerId');

    const game = multiplayerGames.getGame(gameId);
    const player = game && game.players.find((p) => p.playerId === playerId);
    if (!game || !player) {
      socket.close(4004, 'GAME_OR_PLAYER_NOT_FOUND');
      return;
    }

    socketsFor(gameId).add(socket);
    socket.send(JSON.stringify({ type: 'lobby:state', players: game.players }));
    broadcast(gameId, { type: 'player:joined', player }, socket);

    socket.on('close', () => {
      socketsFor(gameId).delete(socket);
      multiplayerGames.removePlayer(gameId, playerId);
      broadcast(gameId, { type: 'player:left', playerId });
    });
  });

  return wss;
}

module.exports = { attachWebSocketServer };
