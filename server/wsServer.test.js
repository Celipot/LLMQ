const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const app = require('./index');
const multiplayerGames = require('./multiplayerGames');
const songs = require('./songs');
const gameState = require('./gameState');
const { attachWebSocketServer, scheduleStageTimeout, scheduleDisconnectGrace } = require('./wsServer');

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

  aliceSocket.close();
  bobSocket.close();
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
