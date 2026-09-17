const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const app = require('./index');
const multiplayerGames = require('./multiplayerGames');
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
