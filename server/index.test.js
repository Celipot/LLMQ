const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('./index');
const songs = require('./songs');
const multiplayerGames = require('./multiplayerGames');
const wsServer = require('./wsServer');

let server;
let baseUrl;

const [songA, songB] = songs.getPlayableTitles();

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(async () => {
  await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
});

test('GET /api/state starts fresh with no correctTitle', async () => {
  const res = await fetch(`${baseUrl}/api/state`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.attemptsUsed, 0);
  assert.equal(body.allowedSeconds, 1);
  assert.equal(body.status, 'playing');
  assert.equal(body.correctTitle, undefined);
});

test('GET /api/titles includes id/title/artist/status for every playable song', async () => {
  const res = await fetch(`${baseUrl}/api/titles`);
  const titles = await res.json();
  assert.ok(titles.some((t) => t.title === songA.title && t.artist === songA.artist));
  assert.ok(titles.every((t) => typeof t.id === 'number' && typeof t.status === 'string'));
});

test('POST /api/guess with an unknown title is rejected without consuming an attempt', async () => {
  const res = await fetch(`${baseUrl}/api/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Not A Real Song' }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.error, 'UNKNOWN_TITLE');

  const state = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.equal(state.attemptsUsed, 0);
});

test('POST /api/skip advances the tier and is rejected once the game is finished', async () => {
  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  const state = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.equal(state.attemptsUsed, 1);
  assert.deepEqual(state.guesses, [{ type: 'skip', title: null, correct: null }]);

  for (let i = 0; i < 5; i++) {
    await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  }
  const finalState = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.equal(finalState.status, 'lost');

  const rejected = await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).error, 'GAME_FINISHED');
});

test('GET /audio/track never exceeds the currently allowed duration', async () => {
  const first = await fetch(`${baseUrl}/audio/track`);
  const firstBytes = await first.arrayBuffer();

  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });

  const second = await fetch(`${baseUrl}/audio/track`);
  const secondBytes = await second.arrayBuffer();

  assert.ok(secondBytes.byteLength > firstBytes.byteLength);
});

test('POST /api/reset always starts a fresh, unfinished round', async () => {
  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  const res = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
  const body = await res.json();
  assert.equal(body.attemptsUsed, 0);
  assert.equal(body.status, 'playing');
  assert.deepEqual(body.guesses, []);
});

test('POST /api/mode/random resumes the current Random round when it is unfinished', async () => {
  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  const resumed = await (await fetch(`${baseUrl}/api/mode/random`, { method: 'POST' })).json();
  assert.equal(resumed.attemptsUsed, 1);
});

test('POST /api/mode/random draws a new round once the current one is finished', async () => {
  for (let i = 0; i < 6; i++) {
    await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  }
  const fresh = await (await fetch(`${baseUrl}/api/mode/random`, { method: 'POST' })).json();
  assert.equal(fresh.attemptsUsed, 0);
  assert.equal(fresh.status, 'playing');
});

test('POST /api/songs/:id/select with an unknown id is rejected', async () => {
  const res = await fetch(`${baseUrl}/api/songs/-1/select`, { method: 'POST' });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'UNKNOWN_SONG');
});

test('POST /api/songs/:id/select starts a fresh round on that song and shows up as playing in /api/titles', async () => {
  const state = await (await fetch(`${baseUrl}/api/songs/${songA.id}/select`, { method: 'POST' })).json();
  assert.equal(state.attemptsUsed, 0);
  assert.equal(state.status, 'playing');

  const titles = await (await fetch(`${baseUrl}/api/titles`)).json();
  const entry = titles.find((t) => t.id === songA.id);
  assert.equal(entry.status, 'playing');
});

test("POST /api/songs/:id/select resumes that song's round instead of restarting it", async () => {
  await fetch(`${baseUrl}/api/songs/${songA.id}/select`, { method: 'POST' });
  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });

  await fetch(`${baseUrl}/api/songs/${songB.id}/select`, { method: 'POST' });
  const resumed = await (await fetch(`${baseUrl}/api/songs/${songA.id}/select`, { method: 'POST' })).json();
  assert.equal(resumed.attemptsUsed, 1);
});

test('POST /games creates a new multiplayer game with a unique id and host token', async () => {
  const res = await fetch(`${baseUrl}/games`, { method: 'POST' });
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.ok(typeof body.gameId === 'string' && body.gameId.length > 0);
  assert.ok(typeof body.hostToken === 'string' && body.hostToken.length > 0);
});

test('POST /games returns a distinct gameId for each new game', async () => {
  const first = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const second = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  assert.notEqual(first.gameId, second.gameId);
});

test('POST /games reports an explicit error and creates nothing when creation fails server-side', async () => {
  const original = multiplayerGames.createGame;
  multiplayerGames.createGame = () => {
    throw new Error('boom');
  };
  try {
    const res = await fetch(`${baseUrl}/games`, { method: 'POST' });
    const body = await res.json();
    assert.equal(res.status, 500);
    assert.equal(body.error, 'GAME_CREATION_FAILED');
  } finally {
    multiplayerGames.createGame = original;
  }
});

test('GET /games/:id returns the game status', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const res = await fetch(`${baseUrl}/games/${created.gameId}`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, 'lobby');
});

test('GET /games/:id returns 404 for an unknown game', async () => {
  const res = await fetch(`${baseUrl}/games/unknown-id`);
  assert.equal(res.status, 404);
});

test('POST /games/:id/join adds a player and returns a playerId', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const res = await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice' }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.playerId);
  assert.equal(body.players.length, 1);
});

test('POST /games/:id/join rejects a duplicate nickname within the same game', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice' }),
  });
  const res = await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice' }),
  });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.error, 'NICKNAME_TAKEN');
});

test('POST /games/:id/join rejects joining a game that already started', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const game = multiplayerGames.getGame(created.gameId);
  game.status = 'in_progress';
  const res = await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice' }),
  });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.error, 'GAME_NOT_JOINABLE');
});

test('POST /games/:id/join returns 404 for an unknown gameId', async () => {
  const res = await fetch(`${baseUrl}/games/unknown-id/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice' }),
  });
  assert.equal(res.status, 404);
});

test('POST /games/:id/join requires a non-empty nickname', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const res = await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '  ' }),
  });
  assert.equal(res.status, 400);
});

test('POST /games/:id/join links the joining player as host when hostToken matches', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const res = await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice', hostToken: created.hostToken }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(multiplayerGames.getGame(created.gameId).hostPlayerId, body.playerId);
});

async function createLobbyWithTwoPlayers() {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice' }),
  });
  await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Bob' }),
  });
  return created;
}

test('POST /games/:id/start moves the game to in_progress with 2+ players and the correct hostToken', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, 'in_progress');
});

test('POST /games/:id/start rejects a wrong hostToken', async () => {
  const { gameId } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: 'wrong-token' }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.error, 'NOT_HOST');
});

test('POST /games/:id/start rejects a game with no players', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const res = await fetch(`${baseUrl}/games/${created.gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: created.hostToken }),
  });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.error, 'NOT_ENOUGH_PLAYERS');
});

test('POST /games/:id/start succeeds with a single player (solo)', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  await fetch(`${baseUrl}/games/${created.gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Alice' }),
  });
  const res = await fetch(`${baseUrl}/games/${created.gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: created.hostToken }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, 'in_progress');
});

test('POST /games/:id/start rejects starting an already-started game', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  const res = await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.error, 'GAME_NOT_STARTABLE');
});

test('POST /games/:id/start returns 404 for an unknown gameId', async () => {
  const res = await fetch(`${baseUrl}/games/unknown-id/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: 'whatever' }),
  });
  assert.equal(res.status, 404);
});

test('POST /games/:id/start schedules a stage timeout for stage 1', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const original = wsServer.scheduleStageTimeout;
  const calls = [];
  wsServer.scheduleStageTimeout = (...args) => calls.push(args);
  try {
    await fetch(`${baseUrl}/games/${gameId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostToken }),
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], gameId);
    assert.equal(calls[0][1], 1);
  } finally {
    wsServer.scheduleStageTimeout = original;
  }
});

test('GET /games/:id/audio returns 404 before the game has started', async () => {
  const created = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const res = await fetch(`${baseUrl}/games/${created.gameId}/audio`);
  assert.equal(res.status, 404);
});

test('GET /games/:id/audio returns 404 for an unknown game', async () => {
  const res = await fetch(`${baseUrl}/games/unknown-id/audio`);
  assert.equal(res.status, 404);
});

test('GET /games/:id/audio serves audio truncated to stage 1 duration once the game has started', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });

  const res = await fetch(`${baseUrl}/games/${gameId}/audio`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/wav');
  const bytes = await res.arrayBuffer();
  assert.ok(bytes.byteLength > 0);
});

test('List mode guesses never affect the concurrent Random mode round for the same song', async () => {
  await fetch(`${baseUrl}/api/mode/random`, { method: 'POST' });
  const beforeRandomState = await (await fetch(`${baseUrl}/api/state`)).json();

  await fetch(`${baseUrl}/api/songs/${songA.id}/select`, { method: 'POST' });
  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });

  const titles = await (await fetch(`${baseUrl}/api/titles`)).json();
  const listEntry = titles.find((t) => t.id === songA.id);
  assert.equal(listEntry.status, 'playing');

  await fetch(`${baseUrl}/api/mode/random`, { method: 'POST' });
  const afterRandomState = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.equal(afterRandomState.attemptsUsed, beforeRandomState.attemptsUsed);
});
