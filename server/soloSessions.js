// Per-player state for the solo modes (Mode Solo and Bibliothèque). The client
// picks an opaque id and sends it on every solo request; the server keeps only
// what it needs to resume that player's round, and forgets idle sessions.

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID_PATTERN.test(id);
}

// ttlFor lets a session outlive the default idle time (a career is a long game).
function createStore({ ttlMs = DEFAULT_TTL_MS, ttlFor = () => ttlMs, now = Date.now, createSession, onExpire = () => {} }) {
  const sessions = new Map();

  function purgeExpired() {
    for (const [id, session] of sessions) {
      if (session.lastSeenAt < now() - ttlFor(session)) {
        sessions.delete(id);
        onExpire(id);
      }
    }
  }

  function get(id) {
    purgeExpired();
    let session = sessions.get(id);
    if (!session) {
      session = { ...createSession(), id, lastSeenAt: now() };
      sessions.set(id, session);
    }
    session.lastSeenAt = now();
    return session;
  }

  return { get };
}

module.exports = { createStore, isValidSessionId, DEFAULT_TTL_MS };
