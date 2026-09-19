// In-memory store for multiplayer game sessions, keyed by gameId. Separate
// from gameState.js (single-player guess tiers per song round) since a
// multiplayer game tracks lobby/players/stage rather than guesses.

const crypto = require('crypto');

const games = new Map();

function createGame() {
  const game = {
    gameId: crypto.randomUUID(),
    hostToken: crypto.randomUUID(),
    status: 'lobby',
    players: [],
    stage: 0,
    songCount: 1,
    answerWindowSeconds: 60,
  };
  games.set(game.gameId, game);
  return game;
}

function getGame(gameId) {
  return games.get(gameId);
}

function fail(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function joinGame(gameId, nickname, hostToken) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.status !== 'lobby') {
    throw fail('GAME_NOT_JOINABLE');
  }
  if (game.players.some((player) => player.nickname === nickname)) {
    throw fail('NICKNAME_TAKEN');
  }
  const player = { playerId: crypto.randomUUID(), nickname, status: 'active', connected: true };
  game.players.push(player);
  // Links the creator's secret hostToken to their own playerId, the only way
  // the server can later tell "the host" apart from any other player (e.g.
  // to promote someone when they leave — see reassignHostIfNeeded). Only
  // the first join carrying a matching token claims it, so a stale/guessed
  // token can't hijack an already-claimed host slot.
  if (hostToken && hostToken === game.hostToken && !game.hostPlayerId) {
    game.hostPlayerId = player.playerId;
  }
  return { playerId: player.playerId, players: game.players };
}

function removePlayer(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) return;
  game.players = game.players.filter((player) => player.playerId !== playerId);
  if (game.players.length === 0) {
    games.delete(gameId);
  }
}

// Host-only, lobby-only (backlog: "l'hôte choisit le nombre de musiques de
// la partie, 1 à 100"). Kept separate from startGame so the value can be
// tweaked any number of times while players are still gathering.
function setSongCount(gameId, hostToken, count) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.hostToken !== hostToken) {
    throw fail('NOT_HOST');
  }
  if (game.status !== 'lobby') {
    throw fail('GAME_NOT_IN_LOBBY');
  }
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw fail('INVALID_SONG_COUNT');
  }
  game.songCount = count;
  return game;
}

// Host-only, lobby-only (backlog: "le slider de durée... devrait
// correspondre au temps accordé pour deviner une étape"). Controls how long
// players have to answer each stage — not the audio clip length, which is
// fixed (see wsServer.stageDurationFor).
function setAnswerWindowSeconds(gameId, hostToken, seconds) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.hostToken !== hostToken) {
    throw fail('NOT_HOST');
  }
  if (game.status !== 'lobby') {
    throw fail('GAME_NOT_IN_LOBBY');
  }
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 300) {
    throw fail('INVALID_ANSWER_WINDOW');
  }
  game.answerWindowSeconds = seconds;
  return game;
}

function startGame(gameId, hostToken, pickSongId) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.hostToken !== hostToken) {
    throw fail('NOT_HOST');
  }
  if (game.status !== 'lobby') {
    throw fail('GAME_NOT_STARTABLE');
  }
  if (game.players.length < 1) {
    throw fail('NOT_ENOUGH_PLAYERS');
  }
  game.status = 'in_progress';
  game.stage = 1;
  game.songIndex = 1;
  game.songId = pickSongId();
  // Only songs already revealed (song:ended) — kept server-side so a
  // reconnecting client can rebuild its history instead of losing it.
  game.playedSongIds = [];
  game.stageStartedAt = Date.now();
  return game;
}

function submitAnswer(gameId, playerId, title, findSongByTitle, computeScore) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.status !== 'in_progress') {
    throw fail('GAME_NOT_IN_PROGRESS');
  }
  const player = game.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw fail('PLAYER_NOT_FOUND');
  }
  if (player.status !== 'active') {
    throw fail('ALREADY_ANSWERED');
  }

  const matchedSong = findSongByTitle(title);
  const isCorrect = !!matchedSong && matchedSong.id === game.songId;
  if (isCorrect) {
    player.status = 'found';
    player.foundStage = game.stage;
    player.score = computeScore(game.stage);
  } else {
    // One attempt per stage: a wrong guess skips the stage for that player,
    // exactly like a forfeit (so checkStageProgress needs no special case).
    player.status = 'forfeited';
    player.forfeitReason = 'wrong';
  }
  return { correct: isCorrect, stage: game.stage };
}

function forfeitStage(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.status !== 'in_progress') {
    throw fail('GAME_NOT_IN_PROGRESS');
  }
  const player = game.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw fail('PLAYER_NOT_FOUND');
  }
  if (player.status !== 'active') {
    throw fail('ALREADY_ANSWERED');
  }

  player.status = 'forfeited';
  return { stage: game.stage };
}

function timeoutStage(gameId, stage) {
  const game = games.get(gameId);
  if (!game || game.status !== 'in_progress' || game.stage !== stage) {
    return [];
  }
  const timedOutPlayerIds = [];
  for (const player of game.players) {
    if (player.status === 'active') {
      player.status = 'forfeited';
      player.forfeitReason = 'timeout';
      timedOutPlayerIds.push(player.playerId);
    }
  }
  return timedOutPlayerIds;
}

// Runs after any event that could resolve the current stage (found,
// forfeited, timed out). "found" is permanent for the whole song (a player
// who already found it just waits out the remaining stages); only
// "forfeited" players get another try once the stage advances.
//
// When the last stage of the current song resolves, the game either moves
// on to the next song (songIndex < songCount: reveal the finished song,
// roll each player's per-song score into their running totalScore, pick a
// new song, reset stage/players) or ends for good (last song: same
// roll-up, then status becomes 'ended'). pickSongId is only invoked in the
// former case.
function checkStageProgress(gameId, getDurationForStage, maxStage, pickSongId) {
  const game = games.get(gameId);
  if (!game || game.status !== 'in_progress') {
    return { type: 'none' };
  }
  const allResolved = game.players.every((player) => player.status !== 'active');
  if (!allResolved) {
    return { type: 'none' };
  }

  // Skip straight to the end once everyone already found the song: only
  // forfeited players are reset to active on advance, so nobody would be
  // left to play the remaining stages (backlog: "si tout le monde a trouvé,
  // les étapes devraient être skip"). Forfeiting — even unanimously — always
  // just advances one stage: those players still want a longer clip.
  const everyoneFound = game.players.every((player) => player.status === 'found');
  if (everyoneFound) {
    game.stage = maxStage;
    game.stageStartedAt = Date.now();
  }

  if (game.stage < maxStage) {
    game.stage += 1;
    game.stageStartedAt = Date.now();
    for (const player of game.players) {
      if (player.status === 'forfeited') {
        player.status = 'active';
        delete player.forfeitReason;
      }
    }
    return { type: 'advanced', stage: game.stage, durationSeconds: getDurationForStage(game.stage) };
  }

  const finishedSongId = game.songId;
  for (const player of game.players) {
    player.totalScore = (player.totalScore || 0) + (player.score || 0);
  }

  if (game.songIndex < game.songCount) {
    const finishedSongPlayers = game.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      foundStage: player.foundStage ?? null,
      score: player.score ?? 0,
      totalScore: player.totalScore ?? 0,
    }));
    game.playedSongIds.push(finishedSongId);
    game.songIndex += 1;
    game.songId = pickSongId();
    game.stage = 1;
    game.stageStartedAt = Date.now();
    for (const player of game.players) {
      player.status = 'active';
      delete player.foundStage;
      delete player.score;
      delete player.forfeitReason;
    }
    return {
      type: 'songAdvanced',
      finishedSongId,
      finishedSongPlayers,
      songIndex: game.songIndex,
      songCount: game.songCount,
      stage: game.stage,
      durationSeconds: getDurationForStage(game.stage),
    };
  }

  game.status = 'ended';
  return {
    type: 'ended',
    songId: finishedSongId,
    players: game.players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      foundStage: player.foundStage ?? null,
      score: player.totalScore ?? 0,
    })),
  };
}

// Any single player confirming (backlog: "chaque joueur doit appuyer sur le
// bouton") is enough to flip the whole game back to lobby — there's only one
// shared status. Each player's own returnedToLobby flag is tracked purely so
// the lobby screen can show "(en attente)" for stragglers; it doesn't gate
// anything.
function confirmReturnToLobby(gameId, playerId) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  const player = game.players.find((p) => p.playerId === playerId);
  if (!player) {
    throw fail('PLAYER_NOT_FOUND');
  }

  if (game.status === 'ended') {
    game.status = 'lobby';
    game.stage = 0;
    delete game.songId;
    delete game.songIndex;
    delete game.playedSongIds;
    delete game.stageStartedAt;
    for (const p of game.players) {
      p.status = 'active';
      p.returnedToLobby = false;
      delete p.foundStage;
      delete p.score;
      delete p.totalScore;
      delete p.forfeitReason;
    }
  } else if (game.status !== 'lobby') {
    throw fail('GAME_NOT_ENDED');
  }

  player.returnedToLobby = true;
  return game;
}

function kickPlayer(gameId, hostToken, requesterPlayerId, targetPlayerId) {
  const game = games.get(gameId);
  if (!game) {
    throw fail('GAME_NOT_FOUND');
  }
  if (game.hostToken !== hostToken) {
    throw fail('NOT_HOST');
  }
  if (game.status !== 'lobby') {
    throw fail('GAME_NOT_IN_LOBBY');
  }
  if (targetPlayerId === requesterPlayerId) {
    throw fail('CANNOT_KICK_SELF');
  }
  if (!game.players.some((p) => p.playerId === targetPlayerId)) {
    throw fail('PLAYER_NOT_FOUND');
  }
  removePlayer(gameId, targetPlayerId);
  return game;
}

// Called after any removal (voluntary leave, lobby disconnect, kick). If the
// removed player was the host, promotes the oldest remaining player
// (game.players[0] — join order is preserved by push/filter) and rotates
// hostToken so the old, now-orphaned secret stops working. Returns the new
// {hostPlayerId, hostToken} for the caller to deliver privately, or null if
// there was nothing to reassign.
function reassignHostIfNeeded(gameId, removedPlayerId) {
  const game = games.get(gameId);
  if (!game || game.hostPlayerId !== removedPlayerId) {
    return null;
  }
  if (game.players.length === 0) {
    game.hostPlayerId = undefined;
    return null;
  }
  const newHost = game.players[0];
  game.hostToken = crypto.randomUUID();
  game.hostPlayerId = newHost.playerId;
  return { hostPlayerId: newHost.playerId, hostToken: game.hostToken };
}

function markConnected(gameId, playerId) {
  const game = games.get(gameId);
  const player = game && game.players.find((p) => p.playerId === playerId);
  if (player) player.connected = true;
}

function markDisconnected(gameId, playerId) {
  const game = games.get(gameId);
  const player = game && game.players.find((p) => p.playerId === playerId);
  if (player) player.connected = false;
}

module.exports = {
  createGame,
  getGame,
  joinGame,
  removePlayer,
  setSongCount,
  setAnswerWindowSeconds,
  startGame,
  submitAnswer,
  forfeitStage,
  timeoutStage,
  checkStageProgress,
  markConnected,
  markDisconnected,
  confirmReturnToLobby,
  kickPlayer,
  reassignHostIfNeeded,
};
