const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('./index');
const songs = require('./songs');

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
