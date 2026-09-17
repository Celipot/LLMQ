// Realtime layer for multiplayer games (see prompt/user-stories-multiplayer.md
// §2 — WebSocket, server-authoritative). Kept separate from index.js/HTTP
// routes: this module only pushes lobby/game events over WS and reacts to
// disconnects, it never decides HTTP responses.

const { WebSocketServer } = require('ws');
const { URL } = require('url');
const multiplayerGames = require('./multiplayerGames');
const songs = require('./songs');

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

// Lets HTTP routes (e.g. POST /games/:id/start) push events to a game's
// already-connected sockets without reaching into this module's internals.
function broadcastToGame(gameId, message) {
  broadcast(gameId, message);
}

// "durée de l'étape + marge de timeout" (backlog MP-08) was superseded by a
// fixed per-stage answer window (see prompt/user-stories-multiplayer.md
// conversation log) once audio playback stopped being clock-synchronized.
const STAGE_ANSWER_WINDOW_MS = 30000;

function scheduleStageTimeout(gameId, stage, delayMs = STAGE_ANSWER_WINDOW_MS) {
  // unref: this timer must never be the reason the process (or a test run)
  // stays alive — it's a best-effort cleanup, not core work.
  const timer = setTimeout(() => {
    const timedOutPlayerIds = multiplayerGames.timeoutStage(gameId, stage);
    for (const playerId of timedOutPlayerIds) {
      broadcast(gameId, { type: 'player:status', playerId, status: 'forfeited', stage, reason: 'timeout' });
    }
  }, delayMs);
  timer.unref();
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

    socket.on('message', (data) => {
      let payload;
      try {
        payload = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (payload.type === 'answer:submit') {
        try {
          const result = multiplayerGames.submitAnswer(gameId, playerId, payload.value, songs.findSongByTitle);
          socket.send(JSON.stringify({ type: 'answer:result', correct: result.correct }));
          if (result.correct) {
            broadcast(gameId, { type: 'player:status', playerId, status: 'found', stage: result.stage }, socket);
          }
        } catch (err) {
          socket.send(JSON.stringify({ type: 'answer:result', error: err.code || 'ANSWER_FAILED' }));
        }
      } else if (payload.type === 'stage:forfeit') {
        try {
          const result = multiplayerGames.forfeitStage(gameId, playerId);
          broadcast(gameId, { type: 'player:status', playerId, status: 'forfeited', stage: result.stage });
        } catch (err) {
          socket.send(JSON.stringify({ type: 'stage:forfeit:error', error: err.code || 'FORFEIT_FAILED' }));
        }
      }
    });

    socket.on('close', () => {
      socketsFor(gameId).delete(socket);
      // Once a game has started, a dropped connection must not erase the
      // player's progress — they may reconnect with the same playerId and
      // should find their status (active/found/forfeited) unchanged. Only
      // the lobby waiting room treats a disconnect as leaving for good.
      if (game.status === 'lobby') {
        multiplayerGames.removePlayer(gameId, playerId);
        broadcast(gameId, { type: 'player:left', playerId });
      }
    });
  });

  return wss;
}

module.exports = { attachWebSocketServer, broadcastToGame, scheduleStageTimeout };
