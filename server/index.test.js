const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('./index');
const songs = require('./songs');
const multiplayerGames = require('./multiplayerGames');
const wsServer = require('./wsServer');
const gameState = require('./gameState');

const SESSION_HEADER = 'X-Solo-Session';
const DEFAULT_SESSION = 'test-session-default-0000000000';

// Solo routes require a session; every test runs as one player unless it
// passes its own header to model a second player.
function fetch(url, options = {}) {
  return globalThis.fetch(url, {
    ...options,
    headers: { [SESSION_HEADER]: DEFAULT_SESSION, ...options.headers },
  });
}

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

test('POST /api/mode/random discards an unfinished Random round and starts a fresh one', async () => {
  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  const fresh = await (await fetch(`${baseUrl}/api/mode/random`, { method: 'POST' })).json();
  assert.equal(fresh.attemptsUsed, 0);
  assert.equal(fresh.status, 'playing');
});

test('POST /api/mode/random draws a new round once the current one is finished', async () => {
  for (let i = 0; i < 6; i++) {
    await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  }
  const fresh = await (await fetch(`${baseUrl}/api/mode/random`, { method: 'POST' })).json();
  assert.equal(fresh.attemptsUsed, 0);
  assert.equal(fresh.status, 'playing');
});

test('GET /api/generations lists every generation with its song count', async () => {
  const res = await fetch(`${baseUrl}/api/generations`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), songs.getGenerations());
});

const ALL_GENERATIONS = songs.getGenerations().map((g) => g.generation);

function startRandomWith(generations) {
  return fetch(`${baseUrl}/api/mode/random`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generations }),
  });
}

async function revealedGeneration() {
  for (let i = 0; i < 6; i++) {
    await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  }
  const state = await (await fetch(`${baseUrl}/api/state`)).json();
  return songs.findSongByTitle(state.correctTitle).generation;
}

test('POST /api/mode/random with generations draws the round from those generations only', async () => {
  try {
    await startRandomWith(['Musical']);
    assert.equal(await revealedGeneration(), 'Musical');
  } finally {
    await startRandomWith(ALL_GENERATIONS);
  }
});

test('POST /api/reset keeps the generations chosen for Random mode', async () => {
  try {
    await startRandomWith(['Musical']);
    await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
    assert.equal(await revealedGeneration(), 'Musical');
  } finally {
    await startRandomWith(ALL_GENERATIONS);
  }
});

test('POST /api/mode/random rejects an empty or unknown selection', async () => {
  for (const generations of [[], ['Unknown']]) {
    const res = await startRandomWith(generations);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_GENERATIONS');
  }
});

function justPlayed(ids) {
  return Object.fromEntries(ids.map((id) => [id, { plays: 1, wins: 1, stageSum: 1, lastPlayedAt: Date.now() }]));
}

async function finishRoundAndReadSongId() {
  for (let i = 0; i < 6; i++) {
    await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  }
  return (await (await fetch(`${baseUrl}/api/state`)).json()).correctSongId;
}

test('GET /api/state reveals correctSongId only once the round is finished', async () => {
  const playing = await (await fetch(`${baseUrl}/api/state`)).json();
  assert.equal(playing.correctSongId, undefined);
  assert.equal(typeof (await finishRoundAndReadSongId()), 'number');
});

test('POST /api/mode/random with a history avoids the songs played moments ago', async () => {
  const pool = songs.getPoolIds(['Ikizulive']);
  const [target, ...recent] = pool;
  try {
    await fetch(`${baseUrl}/api/mode/random`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generations: ['Ikizulive'], history: justPlayed(recent) }),
    });
    assert.equal(await finishRoundAndReadSongId(), target);
  } finally {
    await startRandomWith(ALL_GENERATIONS);
  }
});

test('POST /api/reset with a history avoids the songs played moments ago', async () => {
  const pool = songs.getPoolIds(['Ikizulive']);
  const [target, ...recent] = pool;
  try {
    await startRandomWith(['Ikizulive']);
    await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: justPlayed(recent) }),
    });
    assert.equal(await finishRoundAndReadSongId(), target);
  } finally {
    await startRandomWith(ALL_GENERATIONS);
  }
});

test('POST /api/mode/random and /api/reset reject a history that is not an object', async () => {
  for (const route of ['/api/mode/random', '/api/reset']) {
    const res = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: 'not-an-object' }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_HISTORY');
  }
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

const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(24, 7)]);
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

async function joinWithAvatar(gameId, nickname, avatar) {
  return fetch(`${baseUrl}/games/${gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, avatar }),
  });
}

test('POST /games/:id/join with an avatar exposes an avatarUrl that serves the image', async () => {
  const { gameId } = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();

  const joined = await (await joinWithAvatar(gameId, 'Alice', PNG_DATA_URL)).json();
  const player = joined.players.find((p) => p.playerId === joined.playerId);
  const image = await fetch(`${baseUrl}${player.avatarUrl}`);

  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG_BYTES);
});

test('POST /games/:id/join rejects an invalid avatar without adding the player', async () => {
  const { gameId } = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();

  const res = await joinWithAvatar(gameId, 'Alice', 'data:image/svg+xml;base64,PHN2Zy8+');

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'INVALID_AVATAR');
  assert.equal(multiplayerGames.getGame(gameId).players.length, 0);
});

test('GET /games/:id/players/:playerId/avatar returns 404 for a player without avatar', async () => {
  const { gameId } = await (await fetch(`${baseUrl}/games`, { method: 'POST' })).json();
  const joined = await (await joinWithAvatar(gameId, 'Alice', undefined)).json();

  const res = await fetch(`${baseUrl}/games/${gameId}/players/${joined.playerId}/avatar`);

  assert.equal(res.status, 404);
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

test('POST /games/:id/songCount lets the host set the number of songs', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, count: 10 }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.songCount, 10);
  assert.equal(multiplayerGames.getGame(gameId).songCount, 10);
});

test('POST /games/:id/songCount rejects a wrong hostToken', async () => {
  const { gameId } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: 'wrong-token', count: 10 }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.error, 'NOT_HOST');
});

test('POST /games/:id/songCount rejects a count outside 1-100', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, count: 101 }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.error, 'INVALID_SONG_COUNT');
});

test('POST /games/:id/songCount rejects once the game has started', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  const res = await fetch(`${baseUrl}/games/${gameId}/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, count: 10 }),
  });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.error, 'GAME_NOT_IN_LOBBY');
});

test('POST /games/:id/songCount returns 404 for an unknown gameId', async () => {
  const res = await fetch(`${baseUrl}/games/unknown-id/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: 'whatever', count: 10 }),
  });
  assert.equal(res.status, 404);
});

test('POST /games/:id/answerWindow lets the host set the answer window duration', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/answerWindow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, seconds: 45 }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.answerWindowSeconds, 45);
  assert.equal(multiplayerGames.getGame(gameId).answerWindowSeconds, 45);
});

test('POST /games/:id/answerWindow rejects a wrong hostToken', async () => {
  const { gameId } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/answerWindow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: 'wrong-token', seconds: 45 }),
  });
  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.error, 'NOT_HOST');
});

test('POST /games/:id/answerWindow rejects a value outside 10-300', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const res = await fetch(`${baseUrl}/games/${gameId}/answerWindow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, seconds: 301 }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.error, 'INVALID_ANSWER_WINDOW');
});

test('POST /games/:id/answerWindow rejects once the game has started', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  const res = await fetch(`${baseUrl}/games/${gameId}/answerWindow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, seconds: 45 }),
  });
  const body = await res.json();
  assert.equal(res.status, 409);
  assert.equal(body.error, 'GAME_NOT_IN_LOBBY');
});

test('POST /games/:id/answerWindow returns 404 for an unknown gameId', async () => {
  const res = await fetch(`${baseUrl}/games/unknown-id/answerWindow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: 'whatever', seconds: 45 }),
  });
  assert.equal(res.status, 404);
});

function postGenerations(gameId, body) {
  return fetch(`${baseUrl}/games/${gameId}/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('POST /games/:id/generations lets the host restrict the generations', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const res = await postGenerations(gameId, { hostToken, generations: ['Aqours', 'Liella'] });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).generations, ['Aqours', 'Liella']);
  assert.deepEqual(multiplayerGames.getGame(gameId).generations, ['Aqours', 'Liella']);
});

test('POST /games/:id/generations rejects a wrong hostToken', async () => {
  const { gameId } = await createLobbyWithTwoPlayers();
  const res = await postGenerations(gameId, { hostToken: 'wrong-token', generations: ['Aqours'] });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'NOT_HOST');
});

test('POST /games/:id/generations rejects an empty or unknown selection', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  for (const generations of [[], ['Unknown']]) {
    const res = await postGenerations(gameId, { hostToken, generations });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_GENERATIONS');
  }
});

test('POST /games/:id/generations rejects once the game has started', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  const res = await postGenerations(gameId, { hostToken, generations: ['Aqours'] });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'GAME_NOT_IN_LOBBY');
});

test('POST /games/:id/generations returns 404 for an unknown gameId', async () => {
  const res = await postGenerations('unknown-id', { hostToken: 'token', generations: ['Aqours'] });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'GAME_NOT_FOUND');
});

test('POST /games/:id/start draws the song from the chosen generations', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  await postGenerations(gameId, { hostToken, generations: ['Musical'] });
  await fetch(`${baseUrl}/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  });
  assert.equal(songs.getSongById(multiplayerGames.getGame(gameId).songId).generation, 'Musical');
});

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

test('POST /games/:id/start broadcasts the answer window duration alongside stage:start', async () => {
  const { gameId, hostToken } = await createLobbyWithTwoPlayers();
  const original = wsServer.broadcastToGame;
  const calls = [];
  wsServer.broadcastToGame = (...args) => calls.push(args);
  try {
    await fetch(`${baseUrl}/games/${gameId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostToken }),
    });
    const stageStartCall = calls.find(([, message]) => message.type === 'stage:start');
    assert.equal(stageStartCall[1].answerWindowMs, multiplayerGames.getGame(gameId).answerWindowSeconds * 1000);
    assert.equal(stageStartCall[1].nextDurationSeconds, gameState.TIERS_SECONDS[1]);
    assert.equal(stageStartCall[1].maxStage, gameState.TIERS_SECONDS.length);
  } finally {
    wsServer.broadcastToGame = original;
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

test('GET /games/:id/audio clip length is unaffected by the host-configured answer window', async () => {
  const defaultGame = await createLobbyWithTwoPlayers();
  await fetch(`${baseUrl}/games/${defaultGame.gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: defaultGame.hostToken }),
  });
  // Force the same song for both games — a byte-length comparison across two
  // different random songs isn't meaningful (their source WAVs can differ).
  const songId = multiplayerGames.getGame(defaultGame.gameId).songId;
  const defaultBytes = await (await fetch(`${baseUrl}/games/${defaultGame.gameId}/audio`)).arrayBuffer();

  const longAnswerWindowGame = await createLobbyWithTwoPlayers();
  await fetch(`${baseUrl}/games/${longAnswerWindowGame.gameId}/answerWindow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: longAnswerWindowGame.hostToken, seconds: 200 }),
  });
  await fetch(`${baseUrl}/games/${longAnswerWindowGame.gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken: longAnswerWindowGame.hostToken }),
  });
  multiplayerGames.getGame(longAnswerWindowGame.gameId).songId = songId;
  const longAnswerWindowBytes = await (
    await fetch(`${baseUrl}/games/${longAnswerWindowGame.gameId}/audio`)
  ).arrayBuffer();

  assert.equal(longAnswerWindowBytes.byteLength, defaultBytes.byteLength);
});

const PLAYER_A = { [SESSION_HEADER]: 'player-a-session-000000000000' };
const PLAYER_B = { [SESSION_HEADER]: 'player-b-session-000000000000' };

async function asPlayer(headers, route, options = {}) {
  const res = await fetch(`${baseUrl}${route}`, { ...options, headers: { ...headers, ...options.headers } });
  return res.json();
}

test('solo rounds are isolated per session: one player skipping does not advance another', async () => {
  await asPlayer(PLAYER_A, '/api/reset', { method: 'POST' });
  await asPlayer(PLAYER_B, '/api/reset', { method: 'POST' });

  await asPlayer(PLAYER_A, '/api/skip', { method: 'POST' });

  assert.equal((await asPlayer(PLAYER_A, '/api/state')).attemptsUsed, 1);
  assert.equal((await asPlayer(PLAYER_B, '/api/state')).attemptsUsed, 0);
});

test('solo rounds are isolated per session even when both players are on the same song', async () => {
  await asPlayer(PLAYER_A, `/api/songs/${songA.id}/select`, { method: 'POST' });
  await asPlayer(PLAYER_B, `/api/songs/${songA.id}/select`, { method: 'POST' });

  await asPlayer(PLAYER_A, '/api/skip', { method: 'POST' });

  assert.equal((await asPlayer(PLAYER_B, '/api/state')).attemptsUsed, 0);
  const titlesForB = await asPlayer(PLAYER_B, '/api/titles');
  assert.equal(titlesForB.find((t) => t.id === songA.id).status, 'playing');
  const titlesForA = await asPlayer(PLAYER_A, '/api/titles');
  assert.equal(titlesForA.find((t) => t.id === songA.id).status, 'playing');
});

test('a reset by one player leaves the other player round untouched', async () => {
  await asPlayer(PLAYER_A, '/api/reset', { method: 'POST' });
  await asPlayer(PLAYER_B, '/api/reset', { method: 'POST' });
  await asPlayer(PLAYER_B, '/api/skip', { method: 'POST' });

  await asPlayer(PLAYER_A, '/api/reset', { method: 'POST' });

  assert.equal((await asPlayer(PLAYER_B, '/api/state')).attemptsUsed, 1);
});

test('the generations chosen by one player do not change the pool of another', async () => {
  await asPlayer(PLAYER_A, '/api/mode/random', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generations: ['Musical'] }),
  });
  await asPlayer(PLAYER_B, '/api/reset', { method: 'POST' });

  const pool = new Set(songs.getPoolIds(ALL_GENERATIONS));
  for (let i = 0; i < 6; i++) await asPlayer(PLAYER_B, '/api/skip', { method: 'POST' });
  const revealed = await asPlayer(PLAYER_B, '/api/state');
  assert.ok(pool.has(revealed.correctSongId));

  for (let i = 0; i < 6; i++) await asPlayer(PLAYER_A, '/api/skip', { method: 'POST' });
  const revealedForA = await asPlayer(PLAYER_A, '/api/state');
  assert.equal(songs.getSongById(revealedForA.correctSongId).generation, 'Musical');
});

test('GET /audio/track serves the clip length of the calling session only', async () => {
  await asPlayer(PLAYER_A, `/api/songs/${songA.id}/select`, { method: 'POST' });
  await asPlayer(PLAYER_B, `/api/songs/${songA.id}/select`, { method: 'POST' });
  await asPlayer(PLAYER_A, '/api/skip', { method: 'POST' });

  const clipA = await (await fetch(`${baseUrl}/audio/track`, { headers: PLAYER_A })).arrayBuffer();
  const clipB = await (await fetch(`${baseUrl}/audio/track`, { headers: PLAYER_B })).arrayBuffer();

  assert.ok(clipA.byteLength > clipB.byteLength);
});

test('GET /audio/track accepts the session as a query parameter since <audio> cannot send headers', async () => {
  await asPlayer(PLAYER_A, `/api/songs/${songA.id}/select`, { method: 'POST' });
  await asPlayer(PLAYER_A, '/api/skip', { method: 'POST' });

  const viaHeader = await (await fetch(`${baseUrl}/audio/track`, { headers: PLAYER_A })).arrayBuffer();
  const viaQuery = await (
    await globalThis.fetch(`${baseUrl}/audio/track?sid=${PLAYER_A[SESSION_HEADER]}`)
  ).arrayBuffer();

  assert.equal(viaQuery.byteLength, viaHeader.byteLength);
});

test('solo routes reject a missing or malformed session id', async () => {
  const routes = ['/api/state', '/api/titles', '/audio/track'];
  for (const route of routes) {
    const missing = await globalThis.fetch(`${baseUrl}${route}`);
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error, 'SESSION_REQUIRED');

    const malformed = await globalThis.fetch(`${baseUrl}${route}`, { headers: { [SESSION_HEADER]: 'nope' } });
    assert.equal(malformed.status, 400);
  }
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

// --- Mode Carrière -------------------------------------------------------

const career = require('./career');

let careerSessionCounter = 0;
function newCareerPlayer() {
  careerSessionCounter += 1;
  const headers = { [SESSION_HEADER]: `career-session-${String(careerSessionCounter).padStart(12, '0')}` };
  const call = (method, path, body) =>
    globalThis.fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  // Events draw with Math.random (the turn of the timed ones at creation, the titles they
  // add or remove later): pinning it to 0 makes them fall on the first turn of their
  // window and pick the first titles, so every test sees the same career.
  const EVENT_PATHS = ['/api/career', '/api/career/rest', '/api/guess', '/api/skip', '/api/career/event/choice'];
  return {
    get: (path) => call('GET', path),
    post: (path, body, draw = 0) =>
      EVENT_PATHS.includes(path) ? withFirstDraw(() => call('POST', path, body), draw) : call('POST', path, body),
    delete: (path) => call('DELETE', path),
  };
}

// The drawn title is hidden until the round ends, so tests pin the draw: with
// Math.random at 0 the first title of the discography pool is picked.
async function withFirstDraw(fn, draw = 0) {
  const original = Math.random;
  Math.random = () => draw;
  try {
    return await fn();
  } finally {
    Math.random = original;
  }
}

const firstDiscographySong = songs.getSongById(career.discographyIds(songs.getPlayableTitles())[0]);

async function skipRound(player, times = 3) {
  let last;
  for (let i = 0; i < times; i += 1) last = await (await player.post('/api/skip')).json();
  return last;
}

test('GET /api/career without a career is 404 NO_CAREER', async () => {
  const res = await newCareerPlayer().get('/api/career');
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'NO_CAREER');
});

test('career routes require a solo session', async () => {
  const res = await globalThis.fetch(`${baseUrl}/api/career`, { method: 'POST' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'SESSION_REQUIRED');
});

test('POST /api/career starts a career with full energy, no stats and the base help', async () => {
  const body = await (await newCareerPlayer().post('/api/career')).json();
  assert.equal(body.career.turn, 1);
  assert.equal(body.career.concertAt, 20);
  assert.equal(body.career.finalTurn, 50);
  assert.equal(body.career.releaseAt, 10);
  assert.equal(body.career.energy, 4);
  assert.equal(body.career.maxEnergy, 4);
  assert.deepEqual(body.career.stats, { oreille: 0, memoire: 0, culture: 0 });
  assert.equal(body.career.suggestionCount, 1);
  assert.deepEqual(body.career.notebook, []);
  assert.equal(body.career.release, null);
  assert.equal(body.career.concertDue, false);
  assert.deepEqual(body.career.fans, { current: 0, required: 750 });
  assert.equal(body.career.failure, null);
  assert.equal(body.career.finalScore, null);
  assert.equal(body.career.albumGoalGrade, 'B');
  assert.deepEqual(body.career.concert, { done: 0, total: 15 });
  assert.equal(body.career.concertResult, null);
  assert.equal(body.round, null);
});

test('each player has their own career', async () => {
  const first = newCareerPlayer();
  const second = newCareerPlayer();
  await first.post('/api/career');
  await first.post('/api/career/rest');
  assert.equal((await second.get('/api/career')).status, 404);
});

test('POST /api/career/rest spends the turn and gives the energy back up to the maximum', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const body = await (await player.post('/api/career/rest')).json();
  assert.equal(body.career.turn, 2);
  assert.equal(body.career.energy, 4);
});

test('POST /api/career/study with an unknown stat is rejected and starts no round', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const res = await player.post('/api/career/study', { stat: 'souffle' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'INVALID_STAT');
  assert.equal((await (await player.get('/api/career')).json()).round, null);
});

test('POST /api/career/study starts a round of 3 tiers of 1 second, without revealing the title', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const res = await withFirstDraw(() => player.post('/api/career/study', { stat: 'oreille' }));
  const raw = await res.text();
  const body = JSON.parse(raw);
  assert.equal(body.round.kind, 'study');
  assert.equal(body.round.stat, 'oreille');
  assert.equal(body.round.state.maxAttempts, 3);
  assert.equal(body.round.state.allowedSeconds, 1);
  assert.equal(body.round.state.status, 'playing');
  assert.ok(!raw.includes(firstDiscographySong.title));
});

test('a career round lengthens the intro at each attempt: 1 s, then 2 s, then 3 s', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const started = await (await player.post('/api/career/study', { stat: 'oreille' })).json();
  const afterFirstSkip = await (await player.post('/api/skip')).json();
  const afterSecondSkip = await (await player.post('/api/skip')).json();
  assert.deepEqual(
    [started.round.state.allowedSeconds, afterFirstSkip.state.allowedSeconds, afterSecondSkip.state.allowedSeconds],
    [1, 2, 3],
  );
});

test('rest and study are refused while a round is in progress', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await player.post('/api/career/study', { stat: 'oreille' });
  for (const [path, body] of [['/api/career/rest'], ['/api/career/study', { stat: 'memoire' }]]) {
    const res = await player.post(path, body);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'ROUND_IN_PROGRESS');
  }
});

test('a lost study costs the energy, uses the turn and teaches a little', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await player.post('/api/career/study', { stat: 'memoire' });
  const last = await skipRound(player);
  assert.equal(last.state.status, 'lost');
  assert.equal(last.career.energy, 3);
  assert.equal(last.career.turn, 2);
  assert.equal(last.career.stats.memoire, 15);
  assert.equal((await (await player.get('/api/career')).json()).round, null);
});

test('a study won at the first tier teaches more and the song joins the notebook', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await withFirstDraw(() => player.post('/api/career/study', { stat: 'oreille' }));
  const res = await player.post('/api/guess', { title: firstDiscographySong.title });
  const body = await res.json();
  assert.equal(body.correct, true);
  assert.equal(body.career.stats.oreille, 40);
  assert.deepEqual(
    body.career.notebook.map((song) => song.id),
    [firstDiscographySong.id],
  );
});

test('a study is refused without energy', async () => {
  const player = newCareerPlayer();
  // The energy event of the first phase is drawn at turn 10 instead of 5: it
  // must not refill the energy this test drains.
  await player.post('/api/career', undefined, 0.999);
  for (let i = 0; i < 4; i += 1) {
    await player.post('/api/career/study', { stat: 'oreille' });
    await skipRound(player);
  }
  const res = await player.post('/api/career/study', { stat: 'oreille' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'NO_ENERGY');
});

test('the round of a career resumes after the player went to another solo mode', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await player.post('/api/career/study', { stat: 'oreille' });
  await player.post('/api/skip');
  await player.post('/api/mode/random');
  const body = await (await player.get('/api/career')).json();
  assert.equal(body.round.state.attemptsUsed, 1);
  assert.equal(body.round.state.maxAttempts, 3);
});

async function restUntilRelease(player) {
  await player.post('/api/career');
  for (let i = 0; i < 10; i += 1) await player.post('/api/career/rest');
}

test('POST /api/career/release is refused before the 10 turns are spent', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const res = await player.post('/api/career/release');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'RELEASE_NOT_DUE');
});

test('after 10 turns rest and study are refused with RELEASE_DUE', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  const res = await player.post('/api/career/rest');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'RELEASE_DUE');
});

const discographyIds = career.discographyIds(songs.getPlayableTitles());
const albumSong = (index) => songs.getSongById(discographyIds[index]);

// With Math.random at 0 and nothing studied, the album tracks are the first
// titles of the discography, in order.
async function playAlbumTrack(player, index, { draw = 0, guessTitle = albumSong(index).title } = {}) {
  const started = await withFirstDraw(() => player.post('/api/career/release'), draw);
  const round = (await started.json()).round;
  const result = await (await player.post('/api/guess', { title: guessTitle })).json();
  return { round, result };
}

test('the release starts the first track of the album, with its position', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);

  const started = await (await withFirstDraw(() => player.post('/api/career/release'))).json();

  assert.equal(started.round.kind, 'release');
  assert.deepEqual(started.career.album, { done: 0, total: 6 });
});

test('a found track is scored and the album goes on with the next one', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);

  const { result } = await playAlbumTrack(player, 0);

  assert.deepEqual(result.career.album, { done: 1, total: 6 });
  assert.equal(result.career.release, null);
  const next = await (await player.post('/api/career/release')).json();
  assert.equal(next.round.state.attemptsUsed, 0);
});

test('rest and study stay refused between two tracks of the album', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  await playAlbumTrack(player, 0);

  const res = await player.post('/api/career/rest');

  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'RELEASE_DUE');
});

test('an album of 6 tracks found at the first tier scores 600 and is graded S', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);

  let last;
  for (let i = 0; i < 6; i += 1) last = (await playAlbumTrack(player, i)).result;

  assert.equal(last.career.release.score, 600);
  assert.equal(last.career.release.grade, 'S');
  assert.deepEqual(
    last.career.release.tracks.map((track) => track.song.id),
    [0, 1, 2, 3, 4, 5].map((i) => albumSong(i).id),
  );
  assert.ok(last.career.release.tracks.every((track) => track.rank === 'S' && track.points === 100));
});

test('missing every track gives a score of 0 and grade D', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);

  let last;
  for (let i = 0; i < 6; i += 1) {
    await withFirstDraw(() => player.post('/api/career/release'));
    last = await skipRound(player);
  }

  assert.equal(last.career.release.score, 0);
  assert.equal(last.career.release.grade, 'D');
});

test('once the album is released the career goes on with a second phase of turns', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  for (let i = 0; i < 6; i += 1) await playAlbumTrack(player, i);

  const again = await player.post('/api/career/release');
  const rested = await (await player.post('/api/career/rest')).json();

  assert.equal(again.status, 409);
  assert.equal((await again.json()).error, 'RELEASE_NOT_DUE');
  assert.equal(rested.career.turn, 12);
  assert.equal(rested.career.releaseDue, false);
});

// The studied title is the first of the discography, found while studying.
async function studyFirstSongThenRestUntilRelease(player) {
  await player.post('/api/career');
  await withFirstDraw(() => player.post('/api/career/study', { stat: 'oreille' }));
  await player.post('/api/guess', { title: albumSong(0).title });
  for (let i = 0; i < 9; i += 1) await player.post('/api/career/rest');
}

test('an album track comes from the notebook when the source draw favours it', async () => {
  const player = newCareerPlayer();
  await studyFirstSongThenRestUntilRelease(player);

  const { result } = await playAlbumTrack(player, 0, { draw: 0 });

  assert.equal(result.correct, true);
});

test('an album track comes from the whole pool when the source draw does not favour the notebook', async () => {
  const player = newCareerPlayer();
  await studyFirstSongThenRestUntilRelease(player);

  const { result } = await playAlbumTrack(player, 0, { draw: 0.999 });

  assert.equal(result.correct, false);
});

test('once the studied titles are used the album is completed with other titles', async () => {
  const player = newCareerPlayer();
  await studyFirstSongThenRestUntilRelease(player);
  await playAlbumTrack(player, 0, { draw: 0 });

  const { result } = await playAlbumTrack(player, 0);

  assert.equal(result.correct, false);
});

test('the round tells when its title is in the notebook, without revealing the title', async () => {
  const player = newCareerPlayer();
  await studyFirstSongThenRestUntilRelease(player);

  const { round } = await playAlbumTrack(player, 0, { draw: 0 });

  assert.equal(round.inNotebook, true);
  assert.ok(!JSON.stringify(round).includes(albumSong(0).title));
});

test('the round tells when its title is not in the notebook', async () => {
  const player = newCareerPlayer();
  await studyFirstSongThenRestUntilRelease(player);

  const { round } = await playAlbumTrack(player, 0, { draw: 0.999 });

  assert.equal(round.inNotebook, false);
});

// --- Single, deuxième phase et concert -------------------------------------

test('POST /api/career/single starts a single round on a random stat, without revealing the title', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const res = await withFirstDraw(() => player.post('/api/career/single'));
  const raw = await res.text();
  const body = JSON.parse(raw);
  assert.equal(body.round.kind, 'single');
  assert.equal(body.round.stat, 'oreille');
  assert.equal(body.round.state.status, 'playing');
  assert.ok(!raw.includes(firstDiscographySong.title));
});

test('the stat of a single follows the random draw and ignores any stat sent by the client', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const res = await withFirstDraw(() => player.post('/api/career/single', { stat: 'oreille' }), 0.999);
  assert.equal((await res.json()).round.stat, 'culture');
});

test('a single won at the first tier costs 2 energy, teaches more than a study and skips the notebook', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await withFirstDraw(() => player.post('/api/career/single'));

  const body = await (await player.post('/api/guess', { title: firstDiscographySong.title })).json();

  assert.equal(body.correct, true);
  assert.equal(body.career.stats.oreille, 90);
  assert.equal(body.career.energy, 2);
  assert.equal(body.career.turn, 2);
  assert.deepEqual(body.career.notebook, []);
});

test('a single is refused with less than 2 energy', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  for (let i = 0; i < 3; i += 1) {
    await player.post('/api/career/study', { stat: 'oreille' });
    await skipRound(player);
  }
  const res = await player.post('/api/career/single');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'NO_ENERGY');
});

test('a single is refused while a round is in progress', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await player.post('/api/career/study', { stat: 'oreille' });
  const res = await player.post('/api/career/single');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'ROUND_IN_PROGRESS');
});

// The concert asks for 750 fans, which only singles and the album win: every turn is
// a single found at the first tier while the energy allows it, a rest otherwise.
// A single draws the first title not found yet, whatever Math.random says.
async function spendTurnsOnSingles(player, turns) {
  let { career: state } = await (await player.get('/api/career')).json();
  for (let i = 0; i < turns; i += 1) {
    if (state.energy < 2) {
      state = (await (await player.post('/api/career/rest')).json()).career;
      continue;
    }
    await withFirstDraw(() => player.post('/api/career/single'));
    const foundIds = state.notebook.map((song) => song.id);
    const title = songs.getSongById(discographyIds.find((id) => !foundIds.includes(id))).title;
    state = (await (await player.post('/api/guess', { title })).json()).career;
    if (state.pendingChoice) {
      state = (await (await player.post('/api/career/event/choice', { option: 'energy' })).json()).career;
    }
  }
}

async function restUntilConcert(player) {
  await player.post('/api/career');
  await spendTurnsOnSingles(player, 10);
  for (let i = 0; i < 6; i += 1) await playAlbumTrack(player, i);
  await spendTurnsOnSingles(player, 10);
}

// Half of the concert is drawn from the notebook, and events add or remove titles from it
// (the third one takes two away when the concert becomes due): the expected title is
// the one the server draws with Math.random at 0, from the notebook of the moment.
const concertPlayed = new WeakMap();

async function playConcertTrack(player, index) {
  await withFirstDraw(() => player.post('/api/career/concert'));
  const { career: state } = await (await player.get('/api/career')).json();
  const played = index === 0 ? [] : concertPlayed.get(player);
  const id = career.pickPreparedSongId(
    discographyIds,
    state.notebook.map((song) => song.id),
    played,
    career.CONCERT_SIZE,
    () => 0,
  );
  concertPlayed.set(player, [...played, id]);
  return (await player.post('/api/guess', { title: songs.getSongById(id).title })).json();
}

test('POST /api/career/concert is refused before the second phase is over', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  for (let i = 0; i < 6; i += 1) await playAlbumTrack(player, i);
  const res = await player.post('/api/career/concert');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'CONCERT_NOT_DUE');
});

test('after 20 turns rest, study and single are refused with CONCERT_DUE', async () => {
  const player = newCareerPlayer();
  await restUntilConcert(player);
  const calls = [
    ['/api/career/rest'],
    ['/api/career/study', { stat: 'oreille' }],
    ['/api/career/single'],
  ];
  for (const [path, body] of calls) {
    const res = await player.post(path, body);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'CONCERT_DUE');
  }
  assert.equal((await (await player.get('/api/career')).json()).career.concertDue, true);
});

test('the concert starts its first track with its position', async () => {
  const player = newCareerPlayer();
  await restUntilConcert(player);

  const started = await (await withFirstDraw(() => player.post('/api/career/concert'))).json();

  assert.equal(started.round.kind, 'concert');
  assert.deepEqual(started.career.concert, { done: 0, total: 15 });
});

test('a concert of 15 tracks found at the first tier scores 1500 and is graded S', async () => {
  const player = newCareerPlayer();
  await restUntilConcert(player);

  let last;
  for (let i = 0; i < 15; i += 1) last = await playConcertTrack(player, i);

  assert.equal(last.career.concertResult.score, 1500);
  assert.equal(last.career.concertResult.maxScore, 1500);
  assert.equal(last.career.concertResult.grade, 'S');
  assert.equal(last.career.concertResult.tracks.length, 15);
  assert.deepEqual(last.career.concert, { done: 15, total: 15 });
});

test('once the concert is over the career goes on with the third phase', async () => {
  const player = newCareerPlayer();
  await restUntilConcert(player);
  for (let i = 0; i < 15; i += 1) await playConcertTrack(player, i);

  const res = await player.post('/api/career/rest');
  assert.equal(res.status, 200);
  const { career: state } = await res.json();
  assert.equal(state.phase3, true);
  assert.equal(state.turn, 22);
  assert.equal(state.finalScore, null);
});
test('DELETE /api/career abandons the career: the next visit finds none', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await player.post('/api/career/rest');

  const res = await player.delete('/api/career');

  assert.equal(res.status, 204);
  const after = await player.get('/api/career');
  assert.equal(after.status, 404);
  assert.equal((await after.json()).error, 'NO_CAREER');
});

test('DELETE /api/career also drops the round in progress, and a new career can start', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await player.post('/api/career/study', { stat: 'oreille' });

  await player.delete('/api/career');
  const fresh = await (await player.post('/api/career')).json();

  assert.equal(fresh.round, null);
  assert.equal(fresh.career.turn, 1);
});

test('DELETE /api/career only touches the caller career', async () => {
  const first = newCareerPlayer();
  const second = newCareerPlayer();
  await first.post('/api/career');
  await second.post('/api/career');

  await first.delete('/api/career');

  assert.equal((await second.get('/api/career')).status, 200);
});

test('DELETE /api/career requires a solo session', async () => {
  const res = await globalThis.fetch(`${baseUrl}/api/career`, { method: 'DELETE' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'SESSION_REQUIRED');
});

// --- Objectifs : grade de l'album et fans (FSI) ------------------------------

test('a single wins fans, shown on the career', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await withFirstDraw(() => player.post('/api/career/single'));

  const body = await (await player.post('/api/guess', { title: firstDiscographySong.title })).json();

  assert.equal(body.career.fans.current, 40);
});

test('a study wins no fan', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await withFirstDraw(() => player.post('/api/career/study', { stat: 'oreille' }));

  const body = await (await player.post('/api/guess', { title: firstDiscographySong.title })).json();

  assert.equal(body.career.fans.current, 0);
});

test('a perfect album wins 300 fans and the career goes on', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  let last;
  for (let i = 0; i < 6; i += 1) last = (await playAlbumTrack(player, i)).result;

  assert.equal(last.career.fans.current, 300);
  assert.equal(last.career.failure, null);
});

test('an album under the grade B fails the career and nothing can be played afterwards', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  let last;
  for (let i = 0; i < 6; i += 1) {
    await withFirstDraw(() => player.post('/api/career/release'));
    last = await skipRound(player);
  }

  assert.equal(last.career.failure, 'ALBUM_GRADE');
  for (const path of ['/api/career/rest', '/api/career/release', '/api/career/concert']) {
    const res = await player.post(path);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'CAREER_FINISHED');
  }
});

test('an album graded B is enough to go on, but without fans the concert is lost', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  for (let i = 0; i < 3; i += 1) await playAlbumTrack(player, i);
  for (let i = 0; i < 3; i += 1) {
    await withFirstDraw(() => player.post('/api/career/release'));
    await skipRound(player);
  }
  const afterAlbum = (await (await player.get('/api/career')).json()).career;
  assert.equal(afterAlbum.failure, null);
  assert.equal(afterAlbum.fans.current, 150);

  let last;
  for (let i = 0; i < 10; i += 1) last = await (await player.post('/api/career/rest')).json();

  assert.equal(last.career.failure, 'FANS');
  assert.equal(last.career.concertDue, false);
  const res = await player.post('/api/career/concert');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'CAREER_FINISHED');
});

test('the final score is only given once the career is over', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  for (let i = 0; i < 6; i += 1) await playAlbumTrack(player, i);

  const during = (await (await player.get('/api/career')).json()).career;

  assert.equal(during.finalScore, null);
});

async function restUntilPhase3(player) {
  await restUntilConcert(player);
  for (let i = 0; i < 15; i += 1) await playConcertTrack(player, i);
}

test('a career that misses the goals of the finale gets a final score at turn 51', async () => {
  const player = newCareerPlayer();
  await restUntilPhase3(player);
  const { career: before } = await (await player.get('/api/career')).json();
  let last;
  for (let i = 0; i < 30; i += 1) last = await (await player.post('/api/career/rest')).json();

  const stats = Object.values(before.stats).reduce((total, value) => total + value, 0);
  assert.equal(last.career.failure, 'FINALE_GOALS');
  assert.deepEqual(last.career.finalScore, {
    album: 600,
    concert: 1500,
    sorties: 0,
    finale: 0,
    stats,
    fans: before.fans.current,
    total: 600 + 1500 + stats + before.fans.current,
  });
});

test('a failed career also gets a final score', async () => {
  const player = newCareerPlayer();
  await restUntilRelease(player);
  let last;
  for (let i = 0; i < 6; i += 1) {
    await withFirstDraw(() => player.post('/api/career/release'));
    last = await skipRound(player);
  }

  assert.deepEqual(last.career.finalScore, {
    album: 0,
    concert: 0,
    sorties: 0,
    finale: 0,
    stats: 0,
    fans: 0,
    total: 0,
  });
});

// --- Troisième phase, événements et SIF ------------------------------------

test('the third phase exposes its goals, its limits and the stat maximums', async () => {
  const player = newCareerPlayer();
  await restUntilPhase3(player);

  const { career: state } = await (await player.get('/api/career')).json();

  assert.equal(state.phase3, true);
  assert.deepEqual(state.statMax, { oreille: 300, memoire: 300, culture: 200 });
  assert.deepEqual(state.finaleGoals.concerts, { done: 0, good: 0, required: 2, requiredGood: 2 });
  assert.deepEqual(state.finaleGoals.albums, { done: 0, good: 0, required: 3, requiredGood: 2 });
  assert.equal(state.live, null);
  assert.deepEqual(state.sorties, []);
  assert.equal(state.pendingChoice, null);
});

test('a concert of the third phase costs 4 energy and blocks every other action until it is over', async () => {
  const player = newCareerPlayer();
  await restUntilPhase3(player);

  const started = await (await withFirstDraw(() => player.post('/api/career/concert'))).json();

  assert.equal(started.career.energy, 0);
  assert.deepEqual(started.career.live, { kind: 'concert', done: 0, total: 15 });
  await skipRound(player);
  const res = await player.post('/api/career/rest');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'RELEASE_IN_PROGRESS');
});

test('an album of the third phase is refused without 3 energy', async () => {
  const player = newCareerPlayer();
  await restUntilPhase3(player);
  await withFirstDraw(() => player.post('/api/career/concert'));
  await skipRound(player);
  for (let i = 0; i < 14; i += 1) {
    await withFirstDraw(() => player.post('/api/career/concert'));
    await skipRound(player);
  }
  const res = await player.post('/api/career/release');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'NO_ENERGY');
});

test('an album of the third phase is a sortie: 6 tracks, one turn, listed with its grade', async () => {
  const player = newCareerPlayer();
  await restUntilPhase3(player);
  let last;
  for (let i = 0; i < 6; i += 1) {
    await withFirstDraw(() => player.post('/api/career/release'));
    last = await skipRound(player);
  }

  assert.equal(last.career.turn, 22);
  assert.equal(last.career.live, null);
  assert.equal(last.career.sorties.length, 1);
  assert.equal(last.career.sorties[0].kind, 'album');
  assert.equal(last.career.sorties[0].grade, 'D');
  assert.equal(last.career.sorties[0].maxScore, 600);
  assert.equal(last.career.sorties[0].tracks.length, 6);
});

test('the finale is refused before the end of the third phase', async () => {
  const player = newCareerPlayer();
  await restUntilPhase3(player);
  const res = await player.post('/api/career/finale');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'FINALE_NOT_DUE');
});

test('a timed event is returned with the action that triggered it, then cleared', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  let last;
  for (let i = 0; i < 4; i += 1) last = await (await player.post('/api/career/rest')).json();

  assert.deepEqual(last.career.newEvents, [{ id: 1, text: 'Énergie +2' }]);
  assert.deepEqual(last.career.events, [{ id: 1, turn: 5, text: 'Énergie +2' }]);
  const next = await (await player.post('/api/career/rest')).json();
  assert.deepEqual(next.career.newEvents, []);
  assert.equal(next.career.events.length, 1);
});

async function winFiveStudies(player) {
  await player.post('/api/career');
  for (let i = 0; i < 5; i += 1) {
    if (i === 4) await player.post('/api/career/rest');
    await withFirstDraw(() => player.post('/api/career/study', { stat: 'oreille' }));
    await player.post('/api/guess', { title: albumSong(i).title });
  }
}

test('5 studies won in a row ask for a choice and block every action until it is made', async () => {
  const player = newCareerPlayer();
  await winFiveStudies(player);

  const { career: state } = await (await player.get('/api/career')).json();
  assert.deepEqual(state.pendingChoice, {
    eventId: 10,
    options: { stats: { amount: 60 }, energy: { amount: 4 } },
  });
  const res = await player.post('/api/career/rest');
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'EVENT_PENDING');
});

test('choosing the stats reward applies it to the three stats and unblocks the career', async () => {
  const player = newCareerPlayer();
  await winFiveStudies(player);

  const res = await player.post('/api/career/event/choice', { option: 'stats' });

  assert.equal(res.status, 200);
  const { career: state } = await res.json();
  assert.equal(state.pendingChoice, null);
  assert.equal(state.stats.memoire, 60);
  assert.equal(state.stats.culture, 60);
  assert.equal(state.newEvents[0].id, 10);
  assert.equal((await player.post('/api/career/rest')).status, 200);
});

test('an unknown reward is refused and a choice without a pending one too', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  const none = await player.post('/api/career/event/choice', { option: 'stats' });
  assert.equal(none.status, 409);
  assert.equal((await none.json()).error, 'NO_PENDING_CHOICE');

  const pending = newCareerPlayer();
  await winFiveStudies(pending);
  const res = await pending.post('/api/career/event/choice', { option: 'fans' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'INVALID_CHOICE');
});

test('a career guess matches the exact title whatever its case, which a player without suggestions relies on', async () => {
  const player = newCareerPlayer();
  await player.post('/api/career');
  await withFirstDraw(() => player.post('/api/career/study', { stat: 'oreille' }));

  const body = await (await player.post('/api/guess', { title: firstDiscographySong.title.toUpperCase() })).json();

  assert.equal(body.correct, true);
});
