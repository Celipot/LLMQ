const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const app = require('./index');
const multiplayerGames = require('./multiplayerGames');
const songs = require('./songs');
const { attachWebSocketServer } = require('./wsServer');

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
