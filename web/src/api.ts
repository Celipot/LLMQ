import type {
  ApiErrorBody,
  AnswerWindowResponse,
  CareerChoice,
  CareerResponse,
  CareerStat,
  RewardOption,
  CreateGameResponse,
  GameState,
  GameSummary,
  GenerationOption,
  GenerationsResponse,
  GuessResponse,
  JoinGameResponse,
  Leaderboards,
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

type SessionScope = 'solo' | 'career';

const SESSION_KEYS: Record<SessionScope, string> = { solo: 'soloSessionId', career: 'careerSessionId' };
const memorySessionIds: Partial<Record<SessionScope, string>> = {};

function newSessionId(): string {
  // getRandomValues works on plain-http pages (LAN dev), randomUUID does not.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The server keeps each player's rounds under these ids. The solo one lives in
// sessionStorage, not localStorage: tabs of one browser share localStorage and
// would then play (and disturb) the same round. The career one lives in
// localStorage: a career is one long game that must survive closing the tab, and
// two tabs on it are the same career. Storage can be blocked (private mode): the
// id then lives for the page's lifetime only.
function sessionId(scope: SessionScope): string {
  const key = SESSION_KEYS[scope];
  const storage = () => (scope === 'career' ? localStorage : sessionStorage);
  try {
    let id = storage().getItem(key);
    if (!id) {
      id = newSessionId();
      storage().setItem(key, id);
    }
    return id;
  } catch {
    memorySessionIds[scope] ??= newSessionId();
    return memorySessionIds[scope];
  }
}

function soloFetch(url: string, init: RequestInit = {}, scope: SessionScope = 'solo'): Promise<Response> {
  return fetch(url, { ...init, headers: { ...init.headers, 'X-Solo-Session': sessionId(scope) } });
}

export function fetchState(): Promise<GameState> {
  return soloFetch('/api/state').then((res) => parseOrThrow<GameState>(res));
}

export function fetchTitles(): Promise<PlayableSong[]> {
  return soloFetch('/api/titles').then((res) => parseOrThrow<PlayableSong[]>(res));
}

export function submitGuess(title: string, scope: SessionScope = 'solo'): Promise<GuessResponse> {
  return soloFetch(
    '/api/guess',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
    scope,
  ).then((res) => parseOrThrow<GuessResponse>(res));
}

export function submitSkip(scope: SessionScope = 'solo'): Promise<SkipResponse> {
  return soloFetch('/api/skip', { method: 'POST' }, scope).then((res) => parseOrThrow<SkipResponse>(res));
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

export function startCareer(choice: CareerChoice): Promise<CareerResponse> {
  return soloFetch(
    '/api/career',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(choice),
    },
    'career',
  ).then((res) => parseOrThrow<CareerResponse>(res));
}

export function fetchLeaderboards(): Promise<Leaderboards> {
  return fetch('/api/leaderboard')
    .then((res) => parseOrThrow<{ leaderboards: Leaderboards }>(res))
    .then((body) => body.leaderboards);
}

export function fetchCareer(): Promise<CareerResponse> {
  return soloFetch('/api/career', {}, 'career').then((res) => parseOrThrow<CareerResponse>(res));
}

export async function abandonCareer(): Promise<void> {
  const res = await soloFetch('/api/career', { method: 'DELETE' }, 'career');
  if (!res.ok) throw new ApiError('UNKNOWN_ERROR');
}

export function restCareer(): Promise<CareerResponse> {
  return soloFetch('/api/career/rest', { method: 'POST' }, 'career').then((res) => parseOrThrow<CareerResponse>(res));
}

export function studyCareer(stat: CareerStat): Promise<CareerResponse> {
  return soloFetch(
    '/api/career/study',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stat }),
    },
    'career',
  ).then((res) => parseOrThrow<CareerResponse>(res));
}

export function singleCareer(): Promise<CareerResponse> {
  return soloFetch('/api/career/single', { method: 'POST' }, 'career').then((res) => parseOrThrow<CareerResponse>(res));
}

export function concertCareer(): Promise<CareerResponse> {
  return soloFetch('/api/career/concert', { method: 'POST' }, 'career').then((res) => parseOrThrow<CareerResponse>(res));
}

export function releaseCareer(): Promise<CareerResponse> {
  return soloFetch('/api/career/release', { method: 'POST' }, 'career').then((res) => parseOrThrow<CareerResponse>(res));
}

export function finaleCareer(): Promise<CareerResponse> {
  return soloFetch('/api/career/finale', { method: 'POST' }, 'career').then((res) => parseOrThrow<CareerResponse>(res));
}

export function chooseCareerReward(option: RewardOption): Promise<CareerResponse> {
  return soloFetch(
    '/api/career/event/choice',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option }),
    },
    'career',
  ).then((res) => parseOrThrow<CareerResponse>(res));
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

export function audioTrackUrl(scope: SessionScope = 'solo'): string {
  // Cache-busted: the allowed duration may have changed since the last fetch,
  // and the server is the only source of truth for how much audio is served.
  return `/audio/track?sid=${sessionId(scope)}&ts=${Date.now()}`;
}

export function careerAudioTrackUrl(): string {
  return audioTrackUrl('career');
}

export function multiplayerAudioTrackUrl(gameId: string): string {
  return `/games/${gameId}/audio?ts=${Date.now()}`;
}
