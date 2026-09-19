import type {
  ApiErrorBody,
  AnswerWindowResponse,
  CreateGameResponse,
  GameState,
  GameSummary,
  GenerationOption,
  GenerationsResponse,
  GuessResponse,
  JoinGameResponse,
  PlayableSong,
  SkipResponse,
  SongCountResponse,
  SongHistory,
} from './types';

export class ApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError((data as ApiErrorBody).error ?? 'UNKNOWN_ERROR');
  }
  return data as T;
}

const SOLO_SESSION_KEY = 'soloSessionId';
let memorySoloSessionId: string | null = null;

function newSoloSessionId(): string {
  // getRandomValues works on plain-http pages (LAN dev), randomUUID does not.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The server keeps each player's solo round under this id. It lives in
// sessionStorage, not localStorage: tabs of one browser share localStorage and
// would then play (and disturb) the same round. Storage can be blocked
// (private mode): the id then lives for the page's lifetime only.
function soloSessionId(): string {
  try {
    let id = sessionStorage.getItem(SOLO_SESSION_KEY);
    if (!id) {
      id = newSoloSessionId();
      sessionStorage.setItem(SOLO_SESSION_KEY, id);
    }
    return id;
  } catch {
    memorySoloSessionId ??= newSoloSessionId();
    return memorySoloSessionId;
  }
}

function soloFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { ...init.headers, 'X-Solo-Session': soloSessionId() } });
}

export function fetchState(): Promise<GameState> {
  return soloFetch('/api/state').then((res) => parseOrThrow<GameState>(res));
}

export function fetchTitles(): Promise<PlayableSong[]> {
  return soloFetch('/api/titles').then((res) => parseOrThrow<PlayableSong[]>(res));
}

export function submitGuess(title: string): Promise<GuessResponse> {
  return soloFetch('/api/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }).then((res) => parseOrThrow<GuessResponse>(res));
}

export function submitSkip(): Promise<SkipResponse> {
  return soloFetch('/api/skip', { method: 'POST' }).then((res) => parseOrThrow<SkipResponse>(res));
}

export function resetGame(history?: SongHistory): Promise<GameState> {
  return soloFetch('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
  }).then((res) => parseOrThrow<GameState>(res));
}

export function fetchGenerations(): Promise<GenerationOption[]> {
  return fetch('/api/generations').then((res) => parseOrThrow<GenerationOption[]>(res));
}

export function startRandomMode(generations?: string[], history?: SongHistory): Promise<GameState> {
  return soloFetch('/api/mode/random', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generations, history }),
  }).then((res) => parseOrThrow<GameState>(res));
}

export function selectSong(id: number): Promise<GameState> {
  return soloFetch(`/api/songs/${id}/select`, { method: 'POST' }).then((res) => parseOrThrow<GameState>(res));
}

export function createMultiplayerGame(): Promise<CreateGameResponse> {
  return fetch('/games', { method: 'POST' }).then((res) => parseOrThrow<CreateGameResponse>(res));
}

export function fetchGameStatus(gameId: string): Promise<GameSummary> {
  return fetch(`/games/${gameId}`).then((res) => parseOrThrow<GameSummary>(res));
}

export function joinGame(
  gameId: string,
  nickname: string,
  hostToken?: string,
  avatar?: string
): Promise<JoinGameResponse> {
  return fetch(`/games/${gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, hostToken, avatar }),
  }).then((res) => parseOrThrow<JoinGameResponse>(res));
}

export function updateSongCount(gameId: string, hostToken: string, count: number): Promise<SongCountResponse> {
  return fetch(`/games/${gameId}/songCount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, count }),
  }).then((res) => parseOrThrow<SongCountResponse>(res));
}

export function updateAnswerWindow(
  gameId: string,
  hostToken: string,
  seconds: number
): Promise<AnswerWindowResponse> {
  return fetch(`/games/${gameId}/answerWindow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, seconds }),
  }).then((res) => parseOrThrow<AnswerWindowResponse>(res));
}

export function updateGenerations(
  gameId: string,
  hostToken: string,
  generations: string[]
): Promise<GenerationsResponse> {
  return fetch(`/games/${gameId}/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken, generations }),
  }).then((res) => parseOrThrow<GenerationsResponse>(res));
}

export function startMultiplayerGame(gameId: string, hostToken: string): Promise<{ status: string }> {
  return fetch(`/games/${gameId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostToken }),
  }).then((res) => parseOrThrow<{ status: string }>(res));
}

export function audioTrackUrl(): string {
  // Cache-busted: the allowed duration may have changed since the last fetch,
  // and the server is the only source of truth for how much audio is served.
  return `/audio/track?sid=${soloSessionId()}&ts=${Date.now()}`;
}

export function multiplayerAudioTrackUrl(gameId: string): string {
  return `/games/${gameId}/audio?ts=${Date.now()}`;
}
