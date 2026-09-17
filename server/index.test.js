const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('./index');
const songs = require('./songs');

let server;
let baseUrl;

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

test('GET /api/titles includes the playable song with its artist', async () => {
  const res = await fetch(`${baseUrl}/api/titles`);
  const titles = await res.json();
  assert.ok(titles.some((t) => t.title === songs.randomSong.title && t.artist === songs.randomSong.artist));
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

test('POST /api/guess with the correct title wins and reveals the answer', async () => {
  const res = await fetch(`${baseUrl}/api/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: songs.randomSong.title }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.correct, true);
  assert.equal(body.state.status, 'won');
  assert.equal(body.state.correctTitle, songs.randomSong.title);
  assert.equal(body.state.correctArtist, songs.randomSong.artist);
  assert.equal(body.state.correctCoverUrl, songs.randomSong.coverUrl);
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

test('POST /api/guess is rejected once the game is finished', async () => {
  await fetch(`${baseUrl}/api/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: songs.randomSong.title }),
  });
  const res = await fetch(`${baseUrl}/api/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: songs.randomSong.title }),
  });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'GAME_FINISHED');
});

test('GET /audio/track never exceeds the currently allowed duration', async () => {
  const first = await fetch(`${baseUrl}/audio/track`);
  const firstBytes = await first.arrayBuffer();

  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });

  const second = await fetch(`${baseUrl}/audio/track`);
  const secondBytes = await second.arrayBuffer();

  assert.ok(secondBytes.byteLength > firstBytes.byteLength);
});

test('GET /audio/track serves the full track only once the game is finished', async () => {
  const beforeFinish = await fetch(`${baseUrl}/audio/track`);
  const beforeBytes = await beforeFinish.arrayBuffer();

  await fetch(`${baseUrl}/api/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: songs.randomSong.title }),
  });

  const afterFinish = await fetch(`${baseUrl}/audio/track`);
  const afterBytes = await afterFinish.arrayBuffer();

  assert.ok(afterBytes.byteLength > beforeBytes.byteLength);
});

test('POST /api/reset clears attempts and unfinishes the game', async () => {
  await fetch(`${baseUrl}/api/skip`, { method: 'POST' });
  const res = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
  const body = await res.json();
  assert.equal(body.attemptsUsed, 0);
  assert.equal(body.status, 'playing');
  assert.deepEqual(body.guesses, []);
});
