const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStore, isValidSessionId } = require('./soloSessions');

const ID_A = 'a'.repeat(32);
const ID_B = 'b'.repeat(32);

test('two session ids get independent sessions, the same id gets the same one', () => {
  const store = createStore({ createSession: () => ({ activeSongId: null }) });
  store.get(ID_A).activeSongId = 1;
  assert.equal(store.get(ID_B).activeSongId, null);
  assert.equal(store.get(ID_A).activeSongId, 1);
});

test('a session idle past the TTL is dropped and reported through onExpire', () => {
  let clock = 0;
  const expired = [];
  const store = createStore({
    ttlMs: 1000,
    now: () => clock,
    createSession: () => ({ activeSongId: null }),
    onExpire: (id) => expired.push(id),
  });
  store.get(ID_A).activeSongId = 1;
  clock = 1001;
  assert.equal(store.get(ID_B).activeSongId, null);
  assert.deepEqual(expired, [ID_A]);
  assert.equal(store.get(ID_A).activeSongId, null);
});

test('using a session refreshes its TTL', () => {
  let clock = 0;
  const store = createStore({ ttlMs: 1000, now: () => clock, createSession: () => ({ n: 0 }) });
  store.get(ID_A).n = 1;
  clock = 800;
  store.get(ID_A);
  clock = 1500;
  assert.equal(store.get(ID_A).n, 1);
});

test('isValidSessionId accepts uuid-like ids and rejects anything else', () => {
  assert.equal(isValidSessionId('3f2b8c1e-9d4a-4e6b-8a57-1c2d3e4f5a6b'), true);
  assert.equal(isValidSessionId(undefined), false);
  assert.equal(isValidSessionId('short'), false);
  assert.equal(isValidSessionId('x'.repeat(65)), false);
  assert.equal(isValidSessionId('bad id with spaces and symbols !!!!!!!!'), false);
});
