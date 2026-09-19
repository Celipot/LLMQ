// Realtime layer for multiplayer games (see prompt/user-stories-multiplayer.md
// §2 — WebSocket, server-authoritative). Kept separate from index.js/HTTP
// routes: this module only pushes lobby/game events over WS and reacts to
// disconnects, it never decides HTTP responses.

const { WebSocketServer } = require('ws');
const { URL } = require('url');
const multiplayerGames = require('./multiplayerGames');
const songs = require('./songs');
const gameState = require('./gameState');

// gameId -> Set<WebSocket>
const socketsByGame = new Map();

// `${gameId}:${playerId}` -> pending disconnect-grace timer, so a reconnect
// before it fires can cancel it (see scheduleDisconnectGrace below).
const disconnectTimers = new Map();

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
// Now host-configurable per game (backlog: "le slider de durée... devrait
// correspondre au temps accordé pour deviner une étape") via
// multiplayerGames' game.answerWindowSeconds — this is only the default
// seed value for new games and scheduleStageTimeout's fallback.
const DEFAULT_ANSWER_WINDOW_MS = 60000;

// Reuses the single-player tier list so stage N's clip length always matches
// gameState.js's own progression, instead of maintaining a second table.
// Fixed, not host-configurable — the host's duration slider controls the
// answer window (above), not the clip length.
function stageDurationFor(stage) {
  const tierIndex = Math.min(stage - 1, gameState.TIERS_SECONDS.length - 1);
  return gameState.TIERS_SECONDS[tierIndex];
}

// Preview of what's coming after the current stage (backlog: "afficher...
// le temps de l'étape suivante"). null at the last stage of a song — there
// is no next stage within it, the song ends there instead. Unlike
// stageDurationFor, this must NOT clamp past the tier table, so it can't
// reuse that function's Math.min directly for the bounds check.
function nextStageDurationFor(stage) {
  return stage < gameState.TIERS_SECONDS.length ? stageDurationFor(stage + 1) : null;
}

// "délai de grâce" (backlog MP-13): a dropped connection during an active
// game doesn't remove the player (see the close handler below); this only
// tracks the visible connected/disconnected flag (MP-14 broadcasts it),
// it never forces a forfeit — the existing per-stage timeout (MP-08)
// already handles that naturally since a disconnected player just never
// answers.
const DISCONNECT_GRACE_MS = 60000;

function scheduleDisconnectGrace(gameId, playerId, delayMs = DISCONNECT_GRACE_MS) {
  const key = `${gameId}:${playerId}`;
  const timer = setTimeout(() => {
    multiplayerGames.markDisconnected(gameId, playerId);
    disconnectTimers.delete(key);
    broadcast(gameId, { type: 'player:connection', playerId, connected: false });
  }, delayMs);
  timer.unref();
  disconnectTimers.set(key, timer);
}

function cancelDisconnectGrace(gameId, playerId) {
  const key = `${gameId}:${playerId}`;
  const timer = disconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(key);
  }
}

// gameId -> the single pending stage timeout. Stage numbers repeat from one
// song to the next, so a timer left over from an earlier stage/song would
// pass timeoutStage's stage check and forfeit players who just got a fresh
// song — hence at most one live timer per game, cancelled on every transition.
const stageTimers = new Map();

function cancelStageTimeout(gameId) {
  const timer = stageTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    stageTimers.delete(gameId);
  }
}

function scheduleStageTimeout(gameId, stage, delayMs = DEFAULT_ANSWER_WINDOW_MS) {
  cancelStageTimeout(gameId);
  // unref: this timer must never be the reason the process (or a test run)
  // stays alive — it's a best-effort cleanup, not core work.
  const timer = setTimeout(() => {
    stageTimers.delete(gameId);
    const timedOutPlayerIds = multiplayerGames.timeoutStage(gameId, stage);
    for (const playerId of timedOutPlayerIds) {
      broadcast(gameId, { type: 'player:status', playerId, status: 'forfeited', stage, reason: 'timeout' });
    }
    handleStageProgress(gameId);
  }, delayMs);
  timer.unref();
  stageTimers.set(gameId, timer);
}

// After any removal, checks whether the removed player was the host and, if
// so, privately hands the rotated hostToken to whoever got promoted (see
// multiplayerGames.reassignHostIfNeeded). Everyone else isn't told who the
// new host is — no host indicator exists in the UI to show it to them yet.
function notifyHostTransfer(gameId, removedPlayerId) {
  const result = multiplayerGames.reassignHostIfNeeded(gameId, removedPlayerId);
  if (!result) return;
  for (const s of socketsFor(gameId)) {
    if (s.playerId === result.hostPlayerId) {
      s.send(JSON.stringify({ type: 'host:transferred', hostToken: result.hostToken }));
      break;
    }
  }
}

// Checks whether every player has resolved the current stage (found or
// forfeited) and, if so, either advances to the next stage, moves on to the
// next song (still the same game), or ends the game. Called after any event
// that could be the last missing status.
function handleStageProgress(gameId) {
  const game = multiplayerGames.getGame(gameId);
  const answerWindowMs = (game?.answerWindowSeconds ?? DEFAULT_ANSWER_WINDOW_MS / 1000) * 1000;
  const result = multiplayerGames.checkStageProgress(
    gameId,
    stageDurationFor,
    gameState.TIERS_SECONDS.length,
    songs.pickRandomSongId
  );
  if (result.type === 'advanced') {
    broadcast(gameId, {
      type: 'stage:start',
      stage: result.stage,
      maxStage: gameState.TIERS_SECONDS.length,
      durationSeconds: result.durationSeconds,
      serverTimestamp: Date.now(),
      answerWindowMs,
      nextDurationSeconds: nextStageDurationFor(result.stage),
    });
    scheduleStageTimeout(gameId, result.stage, answerWindowMs);
  } else if (result.type === 'songAdvanced') {
    cancelStageTimeout(gameId);
    const finishedSong = songs.getSongById(result.finishedSongId);
    broadcast(gameId, {
      type: 'song:ended',
      song: { title: finishedSong.title, artist: finishedSong.artist, coverUrl: finishedSong.coverUrl },
      players: result.finishedSongPlayers,
      songIndex: result.songIndex - 1,
      songCount: result.songCount,
    });
    broadcast(gameId, {
      type: 'stage:start',
      stage: result.stage,
      maxStage: gameState.TIERS_SECONDS.length,
      durationSeconds: result.durationSeconds,
      serverTimestamp: Date.now(),
      songIndex: result.songIndex,
      songCount: result.songCount,
      answerWindowMs,
      nextDurationSeconds: nextStageDurationFor(result.stage),
    });
    scheduleStageTimeout(gameId, result.stage, answerWindowMs);
  } else if (result.type === 'ended') {
    cancelStageTimeout(gameId);
    const song = songs.getSongById(result.songId);
    broadcast(gameId, {
      type: 'game:ended',
      song: { title: song.title, artist: song.artist, coverUrl: song.coverUrl },
      players: result.players,
    });
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

    // Tagged so a host kick can find and close this exact socket later
    // (socketsFor only tracks the Set, not which player owns which entry).
    socket.playerId = playerId;

    const wasConnected = player.connected;
    multiplayerGames.markConnected(gameId, playerId);
    cancelDisconnectGrace(gameId, playerId);
    socketsFor(gameId).add(socket);

    if (!wasConnected) {
      broadcast(gameId, { type: 'player:connection', playerId, connected: true }, socket);
    }

    if (game.status === 'lobby') {
      socket.send(
        JSON.stringify({
          type: 'lobby:state',
          players: game.players,
          songCount: game.songCount,
          answerWindowSeconds: game.answerWindowSeconds,
        })
      );
    } else {
      // Full resync for a (re)connect mid-game or after it ended (backlog
      // MP-13: "je reçois l'état courant... et me resynchronise").
      const elapsed = Date.now() - (game.stageStartedAt ?? Date.now());
      socket.send(
        JSON.stringify({
          type: 'game:state',
          status: game.status,
          stage: game.stage,
          maxStage: gameState.TIERS_SECONDS.length,
          durationSeconds: stageDurationFor(game.stage),
          remainingMs: Math.max(0, game.answerWindowSeconds * 1000 - elapsed),
          players: game.players,
          songIndex: game.songIndex,
          songCount: game.songCount,
          nextDurationSeconds: nextStageDurationFor(game.stage),
        })
      );
    }
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
          const result = multiplayerGames.submitAnswer(
            gameId,
            playerId,
            payload.value,
            songs.findSongByTitle,
            gameState.score
          );
          socket.send(JSON.stringify({ type: 'answer:result', correct: result.correct }));
          if (result.correct) {
            broadcast(gameId, { type: 'player:status', playerId, status: 'found', stage: result.stage }, socket);
          } else {
            // Unlike "found", the sender has no local ack of the forfeit
            // (answer:result only says "incorrect"), so they get this too.
            broadcast(gameId, {
              type: 'player:status',
              playerId,
              status: 'forfeited',
              stage: result.stage,
              reason: 'wrong',
            });
          }
          handleStageProgress(gameId);
        } catch (err) {
          socket.send(JSON.stringify({ type: 'answer:result', error: err.code || 'ANSWER_FAILED' }));
        }
      } else if (payload.type === 'stage:forfeit') {
        try {
          const result = multiplayerGames.forfeitStage(gameId, playerId);
          broadcast(gameId, { type: 'player:status', playerId, status: 'forfeited', stage: result.stage });
          handleStageProgress(gameId);
        } catch (err) {
          socket.send(JSON.stringify({ type: 'stage:forfeit:error', error: err.code || 'FORFEIT_FAILED' }));
        }
      } else if (payload.type === 'player:returnToLobby') {
        try {
          const updatedGame = multiplayerGames.confirmReturnToLobby(gameId, playerId);
          broadcast(gameId, {
            type: 'game:reset',
            players: updatedGame.players,
            songCount: updatedGame.songCount,
            answerWindowSeconds: updatedGame.answerWindowSeconds,
          });
        } catch (err) {
          socket.send(JSON.stringify({ type: 'player:returnToLobby:error', error: err.code || 'RETURN_FAILED' }));
        }
      } else if (payload.type === 'player:kick') {
        try {
          multiplayerGames.kickPlayer(gameId, payload.hostToken, playerId, payload.targetPlayerId);
          let targetSocket;
          for (const s of socketsFor(gameId)) {
            if (s.playerId === payload.targetPlayerId) targetSocket = s;
          }
          // Private notice goes to the kicked player alone; everyone else
          // just sees the generic player:left (the target is excluded so
          // it doesn't arrive ahead of/instead of their own player:kicked).
          if (targetSocket) {
            targetSocket.send(JSON.stringify({ type: 'player:kicked' }));
          }
          broadcast(gameId, { type: 'player:left', playerId: payload.targetPlayerId }, targetSocket);
          if (targetSocket) {
            targetSocket.close();
          }
          // A kicked target is never the host (self-kick is blocked and
          // only the host can kick), but this stays a harmless no-op if
          // that ever changes rather than silently leaving no host.
          notifyHostTransfer(gameId, payload.targetPlayerId);
        } catch (err) {
          socket.send(JSON.stringify({ type: 'player:kick:error', error: err.code || 'KICK_FAILED' }));
        }
      } else if (payload.type === 'player:leave') {
        // Deliberate exit (backlog MP-15): unlike a dropped connection
        // (MP-08/13, player kept for a possible reconnect), the player is
        // fully removed. They simply disappear from game.players, so
        // checkStageProgress's "everyone resolved" check already treats
        // that as counting toward progression — no special status needed.
        socketsFor(gameId).delete(socket);
        multiplayerGames.removePlayer(gameId, playerId);
        broadcast(gameId, { type: 'player:left', playerId }, socket);
        notifyHostTransfer(gameId, playerId);
        if (game.status === 'in_progress') {
          handleStageProgress(gameId);
        }
      }
    });

    socket.on('close', () => {
      socketsFor(gameId).delete(socket);
      // Nothing left to do if the player already left voluntarily
      // (player:leave above) — avoid scheduling a pointless grace timer or
      // re-broadcasting player:left for someone who's already gone.
      const stillPresent = multiplayerGames.getGame(gameId)?.players.some((p) => p.playerId === playerId);
      if (!stillPresent) return;
      // Once a game has started, a dropped connection must not erase the
      // player's progress — they may reconnect with the same playerId and
      // should find their status (active/found/forfeited) unchanged. Only
      // the lobby waiting room treats a disconnect as leaving for good.
      if (game.status === 'lobby') {
        multiplayerGames.removePlayer(gameId, playerId);
        broadcast(gameId, { type: 'player:left', playerId });
        notifyHostTransfer(gameId, playerId);
      } else if (game.status === 'in_progress') {
        scheduleDisconnectGrace(gameId, playerId);
      }
    });
  });

  return wss;
}

module.exports = {
  attachWebSocketServer,
  broadcastToGame,
  scheduleStageTimeout,
  stageDurationFor,
  nextStageDurationFor,
  scheduleDisconnectGrace,
  DEFAULT_ANSWER_WINDOW_MS,
};
