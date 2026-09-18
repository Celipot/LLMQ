const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const app = require('./index');
const multiplayerGames = require('./multiplayerGames');
const songs = require('./songs');
const gameState = require('./gameState');
const {
  attachWebSocketServer,
  scheduleStageTimeout,
  scheduleDisconnectGrace,
  scheduleSongTransition,
  STAGE_ANSWER_WINDOW_MS,
  SONG_REVEAL_DELAY_MS,
  stageDurationFor,
  nextStageDurationFor,
} = require('./wsServer');

let server;
let wss;
let baseUrl;
let wsUrl;

before(async () => {
  server = http.createServer(app);
  wss = attachWebSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/ws`;
});

after(async () => {
  for (const client of wss.clients) {
    client.terminate();
  }
  await new Promise((resolve) => wss.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

test('nextStageDurationFor previews the next tier for every stage except the last, which has none', () => {
  for (let stage = 1; stage < gameState.TIERS_SECONDS.length; stage += 1) {
    assert.equal(nextStageDurationFor(stage), stageDurationFor(stage + 1));
  }
  assert.equal(nextStageDurationFor(gameState.TIERS_SECONDS.length), null);
});

test('stageDurationFor and nextStageDurationFor scale every tier by the given factor', () => {
  assert.equal(stageDurationFor(1, 3), gameState.TIERS_SECONDS[0] * 3);
  assert.equal(stageDurationFor(4, 3), Math.round(gameState.TIERS_SECONDS[3] * 3));
  assert.equal(nextStageDurationFor(1, 3), Math.round(gameState.TIERS_SECONDS[1] * 3));
  assert.equal(nextStageDurationFor(gameState.TIERS_SECONDS.length, 3), null);
});

test('SONG_REVEAL_DELAY_MS defaults to 10 seconds', () => {
  assert.equal(SONG_REVEAL_DELAY_MS, 10000);
});

async function createGameWithPlayer(nickname) {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const joined = await (
    await fetch(`${baseUrl}/games/${created.gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    })
  ).json();
  return { gameId: created.gameId, playerId: joined.playerId };
}

// Attaches the 'message' listener synchronously at socket creation time (not
// after awaiting 'open') so a message the server sends immediately on
// connection can't arrive before anyone is listening for it — 'ws' does not
// buffer events for listener-less sockets, it just drops them.
function openSocket(gameId, playerId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsUrl}?gameId=${gameId}&playerId=${playerId}`);
    const queue = [];
    const waiters = [];
    socket.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (waiters.length > 0) {
        waiters.shift()(parsed);
      } else {
        queue.push(parsed);
      }
    });
    socket.nextMessage = () =>
      new Promise((res) => {
        if (queue.length > 0) {
          res(queue.shift());
        } else {
          waiters.push(res);
        }
      });
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

test('a joined player receives a lobby:state snapshot with the current players on connect', async () => {
  const { gameId, playerId } = await createGameWithPlayer('Alice');
  const socket = await openSocket(gameId, playerId);
  const message = await socket.nextMessage();
  assert.equal(message.type, 'lobby:state');
  assert.deepEqual(
    message.players.map((p) => p.nickname),
    ['Alice']
  );
  socket.close();
});

test('an already-connected player receives player:joined when another player connects', async () => {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state snapshot

  const bobSocket = await openSocket(gameId, bob.playerId);
  const message = await aliceSocket.nextMessage();

  assert.equal(message.type, 'player:joined');
  assert.equal(message.player.nickname, 'Bob');

  aliceSocket.close();
  bobSocket.close();
});

test('other connected players receive player:left and the player is removed once a socket closes', async () => {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state snapshot
  const bobSocket = await openSocket(gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob

  const leftMessagePromise = aliceSocket.nextMessage();
  bobSocket.close();
  const message = await leftMessagePromise;

  assert.equal(message.type, 'player:left');
  assert.equal(message.playerId, bob.playerId);

  const game = multiplayerGames.getGame(gameId);
  assert.ok(!game.players.some((p) => p.playerId === bob.playerId));

  aliceSocket.close();
});

test('connecting with an unknown gameId or playerId closes the socket', async () => {
  const { gameId } = await createGameWithPlayer('Alice');
  const socket = new WebSocket(`${wsUrl}?gameId=${gameId}&playerId=unknown-player`);
  const closeCode = await new Promise((resolve) => {
    socket.once('close', (code) => resolve(code));
  });
  assert.equal(closeCode, 4004);
});

test('starting the game broadcasts game:started then stage:start to connected sockets', async () => {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state snapshot
  const bobSocket = await openSocket(gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob

  // hostToken isn't exposed by GET /games/:id; fetch it via the game store directly.
  const { hostToken } = multiplayerGames.getGame(gameId);

  const startedPromise = aliceSocket.nextMessage();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });

  const startedMessage = await startedPromise;
  const stageMessage = await aliceSocket.nextMessage();

  assert.equal(startedMessage.type, 'game:started');
  assert.equal(stageMessage.type, 'stage:start');
  assert.equal(stageMessage.stage, 1);
  assert.equal(typeof stageMessage.durationSeconds, 'number');
  assert.equal(typeof stageMessage.serverTimestamp, 'number');
  assert.equal(stageMessage.answerWindowMs, STAGE_ANSWER_WINDOW_MS);
  assert.equal(stageMessage.nextDurationSeconds, gameState.TIERS_SECONDS[1]);

  aliceSocket.close();
  bobSocket.close();
});

test('a host-configured stage duration scales every stage broadcast, including the lobby-wide preview', async () => {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const { hostToken } = multiplayerGames.getGame(gameId);

  const aliceSocket = await openSocket(gameId, aliceId);
  const lobbyStatePromise = aliceSocket.nextMessage();
  await fetch(`${baseUrl}/games/${gameId}/stageDuration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, seconds: 3 }),
  });
  const initialSnapshot = await lobbyStatePromise;
  assert.equal(initialSnapshot.stageOneSeconds, 1); // pre-change snapshot

  const stageDurationMessage = await aliceSocket.nextMessage();
  assert.equal(stageDurationMessage.type, 'lobby:stageDuration');
  assert.equal(stageDurationMessage.stageOneSeconds, 3);

  const startedPromise = aliceSocket.nextMessage();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  await startedPromise; // game:started
  const stageMessage = await aliceSocket.nextMessage();

  assert.equal(stageMessage.durationSeconds, gameState.TIERS_SECONDS[0] * 3);
  assert.equal(stageMessage.nextDurationSeconds, gameState.TIERS_SECONDS[1] * 3);

  aliceSocket.close();
});

async function createStartedGameWithSockets() {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state
  const bobSocket = await openSocket(gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob
  await bobSocket.nextMessage(); // lobby:state

  const { hostToken } = multiplayerGames.getGame(gameId);
  const aliceStartedPromise = aliceSocket.nextMessage();
  const bobStartedPromise = bobSocket.nextMessage();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  await aliceStartedPromise; // game:started
  await aliceSocket.nextMessage(); // stage:start
  await bobStartedPromise; // game:started
  await bobSocket.nextMessage(); // stage:start

  const game = multiplayerGames.getGame(gameId);
  const correctTitle = songs.getSongById(game.songId).title;

  return { gameId, aliceId, aliceSocket, bobId: bob.playerId, bobSocket, correctTitle };
}

test('a correct answer:submit marks the player found and broadcasts player:status to everyone', async () => {
  const { aliceId, aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();

  const bobStatusPromise = bobSocket.nextMessage();
  const aliceResultPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));

  const aliceResult = await aliceResultPromise;
  assert.equal(aliceResult.type, 'answer:result');
  assert.equal(aliceResult.correct, true);

  const bobStatus = await bobStatusPromise;
  assert.equal(bobStatus.type, 'player:status');
  assert.equal(bobStatus.playerId, aliceId);
  assert.equal(bobStatus.status, 'found');
  assert.equal(bobStatus.stage, 1);

  aliceSocket.close();
  bobSocket.close();
});

test('a wrong answer:submit does not finish the stage and can be retried until correct', async () => {
  const { aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();

  const wrongResultPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: 'Definitely Not The Title' }));
  const wrongResult = await wrongResultPromise;
  assert.equal(wrongResult.correct, false);

  const retryResultPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  const retryResult = await retryResultPromise;
  assert.equal(retryResult.correct, true);

  aliceSocket.close();
  bobSocket.close();
});

test('submitting again after already finding the answer is rejected', async () => {
  const { aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();

  const firstResultPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await firstResultPromise;

  const secondResultPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  const secondResult = await secondResultPromise;
  assert.equal(secondResult.type, 'answer:result');
  assert.equal(secondResult.error, 'ALREADY_ANSWERED');

  aliceSocket.close();
  bobSocket.close();
});

test('stage:forfeit marks the player forfeited and broadcasts player:status to everyone including the sender', async () => {
  const { aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  const aliceStatusPromise = aliceSocket.nextMessage();
  const bobStatusPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'stage:forfeit' }));

  const aliceStatus = await aliceStatusPromise;
  const bobStatus = await bobStatusPromise;

  for (const status of [aliceStatus, bobStatus]) {
    assert.equal(status.type, 'player:status');
    assert.equal(status.playerId, aliceId);
    assert.equal(status.status, 'forfeited');
    assert.equal(status.stage, 1);
  }

  aliceSocket.close();
  bobSocket.close();
});

test('stage:forfeit is rejected once the player has already found the answer', async () => {
  const { aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();

  const foundResultPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await foundResultPromise;

  const forfeitErrorPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  const forfeitError = await forfeitErrorPromise;

  assert.equal(forfeitError.type, 'stage:forfeit:error');
  assert.equal(forfeitError.error, 'ALREADY_ANSWERED');

  aliceSocket.close();
  bobSocket.close();
});

test('scheduleStageTimeout forfeits still-active players and broadcasts player:status with reason timeout', async () => {
  const { aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  const aliceTimeoutPromise = aliceSocket.nextMessage();
  const bobTimeoutPromise = bobSocket.nextMessage();
  scheduleStageTimeout(aliceSocket.url.match(/gameId=([^&]+)/)[1], 1, 20);

  const aliceTimeout = await aliceTimeoutPromise;
  const bobTimeout = await bobTimeoutPromise;

  for (const status of [aliceTimeout, bobTimeout]) {
    assert.equal(status.type, 'player:status');
    assert.equal(status.playerId, aliceId);
    assert.equal(status.status, 'forfeited');
    assert.equal(status.reason, 'timeout');
  }

  aliceSocket.close();
  bobSocket.close();
});

test('scheduleStageTimeout does not forfeit a player who already answered before it fires', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();

  const aliceResultPromise = aliceSocket.nextMessage();
  const bobFoundStatusPromise = bobSocket.nextMessage(); // player:status for Alice's correct answer
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await aliceResultPromise;
  await bobFoundStatusPromise;

  const bobTimeoutPromise = bobSocket.nextMessage();
  scheduleStageTimeout(gameId, 1, 20);
  const bobTimeout = await bobTimeoutPromise;

  assert.equal(bobTimeout.type, 'player:status');
  assert.notEqual(bobTimeout.playerId, aliceId);

  const alice = multiplayerGames.getGame(gameId).players.find((p) => p.playerId === aliceId);
  assert.equal(alice.status, 'found');

  aliceSocket.close();
  bobSocket.close();
});

test('a disconnect once the game is in progress does not remove the player nor broadcast player:left', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  let bobReceivedPlayerLeft = false;
  bobSocket.onmessage = () => {
    bobReceivedPlayerLeft = true;
  };
  aliceSocket.close();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(bobReceivedPlayerLeft, false);
  const game = multiplayerGames.getGame(gameId);
  assert.ok(game.players.some((p) => p.playerId === aliceId));

  bobSocket.close();
});

test('reconnecting with the same playerId keeps the forfeited status while the stage has not advanced', async () => {
  // Bob stays active on purpose: if both players resolved, the stage would
  // immediately advance (MP-10) and forfeited players reset to active —
  // this test is specifically about a status surviving a reconnect *while
  // still on the same stage*, so only Alice resolves here.
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  aliceSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  await aliceSocket.nextMessage(); // player:status forfeited for herself
  aliceSocket.close();

  const reconnectedSocket = await openSocket(gameId, aliceId);
  const snapshot = await reconnectedSocket.nextMessage();
  const alice = snapshot.players.find((p) => p.playerId === aliceId);
  assert.equal(alice.status, 'forfeited');
  assert.equal(multiplayerGames.getGame(gameId).stage, 1);

  reconnectedSocket.close();
  bobSocket.close();
});

test('advances to the next stage once every player has resolved the current one', async () => {
  const { gameId, aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();

  const aliceResultPromise = aliceSocket.nextMessage();
  const bobFoundStatusPromise = bobSocket.nextMessage(); // player:status for Alice's correct answer
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await aliceResultPromise;
  await bobFoundStatusPromise;

  const aliceForfeitedStatusPromise = aliceSocket.nextMessage();
  const bobForfeitedStatusPromise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'stage:forfeit' })); // last missing status
  await aliceForfeitedStatusPromise;
  await bobForfeitedStatusPromise;

  const aliceNextStage = await aliceSocket.nextMessage();
  const bobNextStage = await bobSocket.nextMessage();
  for (const message of [aliceNextStage, bobNextStage]) {
    assert.equal(message.type, 'stage:start');
    assert.equal(message.stage, 2);
    assert.equal(message.answerWindowMs, STAGE_ANSWER_WINDOW_MS);
    assert.equal(message.nextDurationSeconds, gameState.TIERS_SECONDS[2]);
  }
  assert.equal(multiplayerGames.getGame(gameId).stage, 2);

  aliceSocket.close();
  bobSocket.close();
});

test('ends the game and reveals the song once the last stage resolves', async () => {
  const { gameId, aliceId, bobId, aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();
  multiplayerGames.getGame(gameId).stage = 6; // last stage (TIERS_SECONDS has 6 entries)

  const aliceResultPromise = aliceSocket.nextMessage();
  const bobFoundStatusPromise = bobSocket.nextMessage(); // player:status for Alice's correct answer
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await aliceResultPromise;
  await bobFoundStatusPromise;

  const aliceForfeitedStatusPromise = aliceSocket.nextMessage();
  const bobForfeitedStatusPromise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  await aliceForfeitedStatusPromise;
  await bobForfeitedStatusPromise;

  const aliceEnded = await aliceSocket.nextMessage();
  const bobEnded = await bobSocket.nextMessage();
  for (const message of [aliceEnded, bobEnded]) {
    assert.equal(message.type, 'game:ended');
    assert.equal(message.song.title, correctTitle);
    const alicePlayer = message.players.find((p) => p.playerId === aliceId);
    const bobPlayer = message.players.find((p) => p.playerId === bobId);
    assert.equal(alicePlayer.foundStage, 6);
    assert.equal(bobPlayer.foundStage, null);
    assert.equal(alicePlayer.score, gameState.score(6));
    assert.equal(bobPlayer.score, 0);
  }
  assert.equal(multiplayerGames.getGame(gameId).status, 'ended');

  aliceSocket.close();
  bobSocket.close();
});

test('ends the game immediately once everyone finds the song early, with no intermediate stage:start broadcasts', async () => {
  const { gameId, aliceId, bobId, aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();
  // Both find it at stage 1 of 6 — nothing should broadcast for stages 2-6.

  const aliceResultPromise = aliceSocket.nextMessage();
  const bobFoundStatusPromise = bobSocket.nextMessage(); // player:status for Alice's correct answer
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await aliceResultPromise;
  await bobFoundStatusPromise;

  const aliceBobFoundPromise = aliceSocket.nextMessage(); // player:status for Bob's correct answer
  const bobResultPromise = bobSocket.nextMessage(); // Bob's own ack
  bobSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await bobResultPromise;
  await aliceBobFoundPromise;

  const aliceEnded = await aliceSocket.nextMessage();
  const bobEnded = await bobSocket.nextMessage();
  for (const message of [aliceEnded, bobEnded]) {
    assert.equal(message.type, 'game:ended');
    const alicePlayer = message.players.find((p) => p.playerId === aliceId);
    const bobPlayer = message.players.find((p) => p.playerId === bobId);
    assert.equal(alicePlayer.foundStage, 1);
    assert.equal(bobPlayer.foundStage, 1);
  }
  assert.equal(multiplayerGames.getGame(gameId).stage, 6);
  assert.equal(multiplayerGames.getGame(gameId).status, 'ended');

  aliceSocket.close();
  bobSocket.close();
});

test('a multi-song game reveals the finished song then starts the next one, ending only after the last song', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  await fetch(`${baseUrl}/games/${created.gameId}/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: created.hostToken, count: 2 }),
  });
  const alice = await (
    await fetch(`${baseUrl}/games/${created.gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Alice', hostToken: created.hostToken }),
    })
  ).json();
  const bob = await (
    await fetch(`${baseUrl}/games/${created.gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(created.gameId, alice.playerId);
  await aliceSocket.nextMessage(); // lobby:state
  const bobSocket = await openSocket(created.gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob
  await bobSocket.nextMessage(); // lobby:state

  const aliceStartedPromise = aliceSocket.nextMessage();
  const bobStartedPromise = bobSocket.nextMessage();
  await fetch(`${baseUrl}/games/${created.gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: created.hostToken }),
  });
  await aliceStartedPromise; // game:started
  const aliceFirstStage = await aliceSocket.nextMessage(); // stage:start (song 1)
  await bobStartedPromise; // game:started
  await bobSocket.nextMessage(); // stage:start (song 1)
  assert.equal(aliceFirstStage.songIndex, 1);
  assert.equal(aliceFirstStage.songCount, 2);

  const firstSongId = multiplayerGames.getGame(created.gameId).songId;
  const firstSongTitle = songs.getSongById(firstSongId).title;
  multiplayerGames.getGame(created.gameId).stage = 6; // last stage of song 1

  const aliceResultPromise = aliceSocket.nextMessage();
  const bobFoundStatusPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: firstSongTitle }));
  await aliceResultPromise;
  await bobFoundStatusPromise;

  const aliceForfeitedStatusPromise = aliceSocket.nextMessage();
  const bobForfeitedStatusPromise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  await aliceForfeitedStatusPromise;
  await bobForfeitedStatusPromise;

  const aliceSongEnded = await aliceSocket.nextMessage();
  const bobSongEnded = await bobSocket.nextMessage();
  for (const message of [aliceSongEnded, bobSongEnded]) {
    assert.equal(message.type, 'song:ended');
    assert.equal(message.song.title, firstSongTitle);
    assert.equal(message.songIndex, 1);
    assert.equal(message.songCount, 2);
    const alicePlayer = message.players.find((p) => p.playerId === alice.playerId);
    assert.equal(alicePlayer.foundStage, 6);
    assert.equal(alicePlayer.score, gameState.score(6));
    assert.equal(alicePlayer.totalScore, gameState.score(6));
    const bobPlayer = message.players.find((p) => p.playerId === bob.playerId);
    assert.equal(bobPlayer.totalScore, 0);
  }

  // Fire the (otherwise 10s-delayed) next-song broadcast now, with a short
  // override delay — mirrors how scheduleStageTimeout is tested directly
  // elsewhere rather than waiting out its real default.
  scheduleSongTransition(created.gameId, 20);

  const aliceSecondStage = await aliceSocket.nextMessage();
  const bobSecondStage = await bobSocket.nextMessage();
  for (const message of [aliceSecondStage, bobSecondStage]) {
    assert.equal(message.type, 'stage:start');
    assert.equal(message.stage, 1);
    assert.equal(message.songIndex, 2);
    assert.equal(message.songCount, 2);
    assert.equal(message.answerWindowMs, STAGE_ANSWER_WINDOW_MS);
    assert.equal(message.nextDurationSeconds, gameState.TIERS_SECONDS[1]);
  }
  const secondSongId = multiplayerGames.getGame(created.gameId).songId;
  assert.notEqual(secondSongId, firstSongId);

  const secondSongTitle = songs.getSongById(secondSongId).title;
  multiplayerGames.getGame(created.gameId).stage = 6; // last stage of song 2

  const aliceResult2Promise = aliceSocket.nextMessage();
  const bobFoundStatus2Promise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: secondSongTitle }));
  await aliceResult2Promise;
  await bobFoundStatus2Promise;

  const aliceForfeited2Promise = aliceSocket.nextMessage();
  const bobForfeited2Promise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  await aliceForfeited2Promise;
  await bobForfeited2Promise;

  const aliceEnded = await aliceSocket.nextMessage();
  const bobEnded = await bobSocket.nextMessage();
  for (const message of [aliceEnded, bobEnded]) {
    assert.equal(message.type, 'game:ended');
    assert.equal(message.song.title, secondSongTitle);
    const alicePlayer = message.players.find((p) => p.playerId === alice.playerId);
    const bobPlayer = message.players.find((p) => p.playerId === bob.playerId);
    // Cumulative across both songs: Alice found both, Bob found neither.
    assert.equal(alicePlayer.score, gameState.score(6) * 2);
    assert.equal(bobPlayer.score, 0);
  }
  assert.equal(multiplayerGames.getGame(created.gameId).status, 'ended');

  aliceSocket.close();
  bobSocket.close();
});

test('no stage:start for the next song arrives right after song:ended — the reveal is genuinely held', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  await fetch(`${baseUrl}/games/${created.gameId}/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: created.hostToken, count: 2 }),
  });
  const alice = await (
    await fetch(`${baseUrl}/games/${created.gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Alice', hostToken: created.hostToken }),
    })
  ).json();
  const bob = await (
    await fetch(`${baseUrl}/games/${created.gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(created.gameId, alice.playerId);
  await aliceSocket.nextMessage(); // lobby:state
  const bobSocket = await openSocket(created.gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob
  await bobSocket.nextMessage(); // lobby:state

  const aliceStartedPromise = aliceSocket.nextMessage();
  await fetch(`${baseUrl}/games/${created.gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: created.hostToken }),
  });
  await aliceStartedPromise; // game:started
  await aliceSocket.nextMessage(); // stage:start (song 1)
  await bobSocket.nextMessage(); // game:started
  await bobSocket.nextMessage(); // stage:start (song 1)

  const firstSongTitle = songs.getSongById(multiplayerGames.getGame(created.gameId).songId).title;
  multiplayerGames.getGame(created.gameId).stage = 6; // last stage of song 1

  const aliceResultPromise = aliceSocket.nextMessage();
  const bobFoundStatusPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: firstSongTitle }));
  await aliceResultPromise;
  await bobFoundStatusPromise;

  const aliceForfeitedStatusPromise = aliceSocket.nextMessage();
  const bobForfeitedStatusPromise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  await aliceForfeitedStatusPromise;
  await bobForfeitedStatusPromise;

  const songEnded = await aliceSocket.nextMessage();
  assert.equal(songEnded.type, 'song:ended');

  const raceResult = await Promise.race([
    aliceSocket.nextMessage().then(() => 'message'),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 50)),
  ]);
  assert.equal(raceResult, 'timeout');

  aliceSocket.close();
  bobSocket.close();
});

test('reconnecting mid-game sends a game:state resync with stage, players and remaining time', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();
  aliceSocket.close();

  const reconnectedSocket = await openSocket(gameId, aliceId);
  const snapshot = await reconnectedSocket.nextMessage();

  assert.equal(snapshot.type, 'game:state');
  assert.equal(snapshot.status, 'in_progress');
  assert.equal(snapshot.stage, 1);
  assert.equal(typeof snapshot.durationSeconds, 'number');
  assert.equal(typeof snapshot.remainingMs, 'number');
  assert.ok(snapshot.remainingMs <= 30000);
  assert.equal(snapshot.nextDurationSeconds, gameState.TIERS_SECONDS[1]);
  assert.ok(snapshot.players.some((p) => p.playerId === aliceId));

  reconnectedSocket.close();
  bobSocket.close();
});

test('reconnecting before the disconnect grace expires cancels it and keeps the player connected', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  aliceSocket.close();
  scheduleDisconnectGrace(gameId, aliceId, 20);
  const reconnectedSocket = await openSocket(gameId, aliceId);
  await reconnectedSocket.nextMessage(); // game:state snapshot

  await new Promise((resolve) => setTimeout(resolve, 40)); // past the grace delay

  const alice = multiplayerGames.getGame(gameId).players.find((p) => p.playerId === aliceId);
  assert.equal(alice.connected, true);

  reconnectedSocket.close();
  bobSocket.close();
});

test('failing to reconnect within the disconnect grace marks the player disconnected without removing them', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  aliceSocket.close();
  scheduleDisconnectGrace(gameId, aliceId, 20);
  await new Promise((resolve) => setTimeout(resolve, 40));

  const game = multiplayerGames.getGame(gameId);
  const alice = game.players.find((p) => p.playerId === aliceId);
  assert.equal(alice.connected, false);
  assert.ok(game.players.some((p) => p.playerId === aliceId));

  bobSocket.close();
});

test('a late reconnect after the grace period still succeeds and marks the player connected again', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  aliceSocket.close();
  scheduleDisconnectGrace(gameId, aliceId, 20);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(multiplayerGames.getGame(gameId).players.find((p) => p.playerId === aliceId).connected, false);

  const reconnectedSocket = await openSocket(gameId, aliceId);
  await reconnectedSocket.nextMessage(); // game:state snapshot
  assert.equal(multiplayerGames.getGame(gameId).players.find((p) => p.playerId === aliceId).connected, true);

  reconnectedSocket.close();
  bobSocket.close();
});

test('broadcasts player:connection false to remaining players once the disconnect grace expires', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  const bobConnectionPromise = bobSocket.nextMessage();
  aliceSocket.close();
  scheduleDisconnectGrace(gameId, aliceId, 20);

  const bobConnection = await bobConnectionPromise;
  assert.equal(bobConnection.type, 'player:connection');
  assert.equal(bobConnection.playerId, aliceId);
  assert.equal(bobConnection.connected, false);

  bobSocket.close();
});

test('broadcasts player:connection true to others once a disconnected player reconnects', async () => {
  const { gameId, aliceId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  aliceSocket.close();
  scheduleDisconnectGrace(gameId, aliceId, 20);
  await new Promise((resolve) => setTimeout(resolve, 40)); // past the grace delay, drain bob's player:connection(false)
  await bobSocket.nextMessage();

  const bobConnectionPromise = bobSocket.nextMessage();
  const reconnectedSocket = await openSocket(gameId, aliceId);
  await reconnectedSocket.nextMessage(); // game:state snapshot for Alice

  const bobConnection = await bobConnectionPromise;
  assert.equal(bobConnection.type, 'player:connection');
  assert.equal(bobConnection.playerId, aliceId);
  assert.equal(bobConnection.connected, true);

  reconnectedSocket.close();
  bobSocket.close();
});

test('does not broadcast player:connection for an ordinary first-time join', async () => {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state

  const nextMessagePromise = aliceSocket.nextMessage();
  const bobSocket = await openSocket(gameId, bob.playerId);
  const message = await nextMessagePromise;

  assert.equal(message.type, 'player:joined');

  aliceSocket.close();
  bobSocket.close();
});

test('player:leave removes the player from the lobby and broadcasts player:left', async () => {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state
  const bobSocket = await openSocket(gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob
  await bobSocket.nextMessage(); // lobby:state

  const bobLeftPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:leave' }));
  const bobLeft = await bobLeftPromise;

  assert.equal(bobLeft.type, 'player:left');
  assert.equal(bobLeft.playerId, aliceId);
  assert.ok(!multiplayerGames.getGame(gameId).players.some((p) => p.playerId === aliceId));

  aliceSocket.close();
  bobSocket.close();
});

test('player:leave during a stage counts as resolving it for progression', async () => {
  const { gameId, aliceId, bobId, aliceSocket, bobSocket } = await createStartedGameWithSockets();

  const bobLeftPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:leave' }));
  await bobLeftPromise;

  const bobStagePromise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  await bobStagePromise; // player:status forfeited for Bob himself

  const bobNextStage = await bobSocket.nextMessage();
  assert.equal(bobNextStage.type, 'stage:start');
  assert.equal(bobNextStage.stage, 2);
  assert.equal(multiplayerGames.getGame(gameId).players.length, 1);
  assert.equal(multiplayerGames.getGame(gameId).players[0].playerId, bobId);

  void aliceId;
  bobSocket.close();
});

test('closing the socket after an explicit player:leave does not re-broadcast player:left', async () => {
  const { gameId, playerId: aliceId } = await createGameWithPlayer('Alice');
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state
  const bobSocket = await openSocket(gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob
  await bobSocket.nextMessage(); // lobby:state

  const bobLeftPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:leave' }));
  await bobLeftPromise;

  let bobReceivedAnotherMessage = false;
  bobSocket.onmessage = () => {
    bobReceivedAnotherMessage = true;
  };
  aliceSocket.close();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(bobReceivedAnotherMessage, false);

  bobSocket.close();
});

test('a game is purged once its last player leaves', async () => {
  const { gameId, playerId } = await createGameWithPlayer('Alice');
  const socket = await openSocket(gameId, playerId);
  await socket.nextMessage(); // lobby:state

  socket.send(JSON.stringify({ type: 'player:leave' }));
  await new Promise((resolve) => setTimeout(resolve, 20));

  const res = await fetch(`${baseUrl}/games/${gameId}`);
  assert.equal(res.status, 404);

  socket.close();
});

async function endGame(gameId, aliceSocket, bobSocket, correctTitle) {
  multiplayerGames.getGame(gameId).stage = 6; // last stage (TIERS_SECONDS has 6 entries)

  const aliceResultPromise = aliceSocket.nextMessage();
  const bobFoundStatusPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'answer:submit', value: correctTitle }));
  await aliceResultPromise;
  await bobFoundStatusPromise;

  const aliceForfeitedStatusPromise = aliceSocket.nextMessage();
  const bobForfeitedStatusPromise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'stage:forfeit' }));
  await aliceForfeitedStatusPromise;
  await bobForfeitedStatusPromise;

  await aliceSocket.nextMessage(); // game:ended
  await bobSocket.nextMessage(); // game:ended
}

test('player:returnToLobby resets the game to lobby and broadcasts the updated players to everyone', async () => {
  const { gameId, aliceId, bobId, aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();
  await endGame(gameId, aliceSocket, bobSocket, correctTitle);

  const aliceResetPromise = aliceSocket.nextMessage();
  const bobResetPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:returnToLobby' }));

  const aliceReset = await aliceResetPromise;
  const bobReset = await bobResetPromise;
  for (const message of [aliceReset, bobReset]) {
    assert.equal(message.type, 'game:reset');
    const alicePlayer = message.players.find((p) => p.playerId === aliceId);
    const bobPlayer = message.players.find((p) => p.playerId === bobId);
    assert.equal(alicePlayer.returnedToLobby, true);
    assert.equal(bobPlayer.returnedToLobby, false);
    assert.equal(alicePlayer.status, 'active');
  }

  const res = await fetch(`${baseUrl}/games/${gameId}`);
  assert.equal((await res.json()).status, 'lobby');

  aliceSocket.close();
  bobSocket.close();
});

test('a second player confirming return only updates their own returnedToLobby flag', async () => {
  const { gameId, aliceId, bobId, aliceSocket, bobSocket, correctTitle } = await createStartedGameWithSockets();
  await endGame(gameId, aliceSocket, bobSocket, correctTitle);

  const aliceOwnResetPromise = aliceSocket.nextMessage();
  const bobResetPromise1 = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:returnToLobby' }));
  await aliceOwnResetPromise; // game:reset echoed back to Alice herself
  await bobResetPromise1;

  const aliceResetPromise = aliceSocket.nextMessage();
  const bobResetPromise2 = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'player:returnToLobby' }));

  const aliceReset = await aliceResetPromise;
  const bobReset = await bobResetPromise2;
  for (const message of [aliceReset, bobReset]) {
    const alicePlayer = message.players.find((p) => p.playerId === aliceId);
    const bobPlayer = message.players.find((p) => p.playerId === bobId);
    assert.equal(alicePlayer.returnedToLobby, true);
    assert.equal(bobPlayer.returnedToLobby, true);
  }

  aliceSocket.close();
  bobSocket.close();
});

test('player:returnToLobby is rejected while the game is still in progress', async () => {
  const { aliceSocket, bobSocket } = await createStartedGameWithSockets();

  const aliceErrorPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:returnToLobby' }));
  const aliceError = await aliceErrorPromise;

  assert.equal(aliceError.type, 'player:returnToLobby:error');
  assert.equal(aliceError.error, 'GAME_NOT_ENDED');

  aliceSocket.close();
  bobSocket.close();
});

async function createLobbyWithSockets() {
  const { gameId, hostToken, playerId: aliceId } = await (async () => {
    const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
    const joined = await (
      await fetch(`${baseUrl}/games/${created.gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: 'Alice' }),
      })
    ).json();
    return { gameId: created.gameId, hostToken: created.hostToken, playerId: joined.playerId };
  })();
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, aliceId);
  await aliceSocket.nextMessage(); // lobby:state
  const bobSocket = await openSocket(gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob
  await bobSocket.nextMessage(); // lobby:state

  return { gameId, hostToken, aliceId, bobId: bob.playerId, aliceSocket, bobSocket };
}

test('a host kicking a player removes them, broadcasts player:left, and closes their socket with player:kicked', async () => {
  const { gameId, hostToken, aliceId, bobId, aliceSocket, bobSocket } = await createLobbyWithSockets();

  const bobKickedPromise = bobSocket.nextMessage();
  const bobClosePromise = new Promise((resolve) => bobSocket.once('close', resolve));
  aliceSocket.send(JSON.stringify({ type: 'player:kick', hostToken, targetPlayerId: bobId }));

  const bobKicked = await bobKickedPromise;
  assert.equal(bobKicked.type, 'player:kicked');
  await bobClosePromise;

  const game = multiplayerGames.getGame(gameId);
  assert.ok(!game.players.some((p) => p.playerId === bobId));
  assert.ok(game.players.some((p) => p.playerId === aliceId));

  aliceSocket.close();
});

test('other players receive player:left once the host kicks someone', async () => {
  const { hostToken, bobId, aliceSocket, bobSocket } = await createLobbyWithSockets();

  const aliceLeftPromise = aliceSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:kick', hostToken, targetPlayerId: bobId }));
  const aliceLeft = await aliceLeftPromise;

  assert.equal(aliceLeft.type, 'player:left');
  assert.equal(aliceLeft.playerId, bobId);

  aliceSocket.close();
  bobSocket.close();
});

test('a non-host attempting to kick receives a private NOT_HOST error', async () => {
  const { aliceId, aliceSocket, bobSocket } = await createLobbyWithSockets();

  const bobErrorPromise = bobSocket.nextMessage();
  bobSocket.send(JSON.stringify({ type: 'player:kick', hostToken: 'wrong-token', targetPlayerId: aliceId }));
  const bobError = await bobErrorPromise;

  assert.equal(bobError.type, 'player:kick:error');
  assert.equal(bobError.error, 'NOT_HOST');

  aliceSocket.close();
  bobSocket.close();
});

// Unlike createLobbyWithSockets (whose Alice joins without a hostToken, since
// the kick tests only need hostToken as a bearer secret), host-transfer needs
// game.hostPlayerId actually linked to Alice, which only happens when her
// join request carries the game's hostToken.
async function createLobbyWithLinkedHost() {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const { gameId, hostToken } = created;
  const alice = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Alice', hostToken }),
    })
  ).json();
  const bob = await (
    await fetch(`${baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'Bob' }),
    })
  ).json();

  const aliceSocket = await openSocket(gameId, alice.playerId);
  await aliceSocket.nextMessage(); // lobby:state
  const bobSocket = await openSocket(gameId, bob.playerId);
  await aliceSocket.nextMessage(); // player:joined for Bob
  await bobSocket.nextMessage(); // lobby:state

  return { gameId, hostToken, aliceId: alice.playerId, bobId: bob.playerId, aliceSocket, bobSocket };
}

test('when the host leaves, the oldest remaining player is privately promoted with a new hostToken', async () => {
  const { gameId, hostToken, bobId, aliceSocket, bobSocket } = await createLobbyWithLinkedHost();

  const bobLeftPromise = bobSocket.nextMessage(); // player:left for Alice
  const bobTransferPromise = bobSocket.nextMessage();
  aliceSocket.send(JSON.stringify({ type: 'player:leave' }));

  const bobLeft = await bobLeftPromise;
  assert.equal(bobLeft.type, 'player:left');
  const bobTransfer = await bobTransferPromise;
  assert.equal(bobTransfer.type, 'host:transferred');
  assert.notEqual(bobTransfer.hostToken, hostToken);

  const game = multiplayerGames.getGame(gameId);
  assert.equal(game.hostPlayerId, bobId);
  assert.equal(game.hostToken, bobTransfer.hostToken);

  bobSocket.close();
});

test('the new hostToken works for host actions while the old one no longer does', async () => {
  const { gameId, hostToken, aliceSocket, bobSocket } = await createLobbyWithLinkedHost();

  const bobTransferPromise = (async () => {
    await bobSocket.nextMessage(); // player:left for Alice
    return bobSocket.nextMessage();
  })();
  aliceSocket.send(JSON.stringify({ type: 'player:leave' }));
  const bobTransfer = await bobTransferPromise;

  const oldTokenResponse = await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  assert.equal(oldTokenResponse.status, 403);

  const newTokenResponse = await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: bobTransfer.hostToken }),
  });
  assert.equal(newTokenResponse.status, 200);

  bobSocket.close();
});

test('a lobby disconnect of the host also promotes the oldest remaining player', async () => {
  const { gameId, bobId, aliceSocket, bobSocket } = await createLobbyWithLinkedHost();

  const bobLeftPromise = bobSocket.nextMessage(); // player:left for Alice
  const bobTransferPromise = bobSocket.nextMessage();
  aliceSocket.close();

  await bobLeftPromise;
  const bobTransfer = await bobTransferPromise;
  assert.equal(bobTransfer.type, 'host:transferred');

  const game = multiplayerGames.getGame(gameId);
  assert.equal(game.hostPlayerId, bobId);

  bobSocket.close();
});
