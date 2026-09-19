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

export function fetchState(): Promise<GameState> {
  return fetch('/api/state').then((res) => parseOrThrow<GameState>(res));
}

export function fetchTitles(): Promise<PlayableSong[]> {
  return fetch('/api/titles').then((res) => parseOrThrow<PlayableSong[]>(res));
}

export function submitGuess(title: string): Promise<GuessResponse> {
  return fetch('/api/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }).then((res) => parseOrThrow<GuessResponse>(res));
}

export function submitSkip(): Promise<SkipResponse> {
  return fetch('/api/skip', { method: 'POST' }).then((res) => parseOrThrow<SkipResponse>(res));
}

export function resetGame(): Promise<GameState> {
  return fetch('/api/reset', { method: 'POST' }).then((res) => parseOrThrow<GameState>(res));
}

export function fetchGenerations(): Promise<GenerationOption[]> {
  return fetch('/api/generations').then((res) => parseOrThrow<GenerationOption[]>(res));
}

export function startRandomMode(generations?: string[]): Promise<GameState> {
  return fetch('/api/mode/random', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generations }),
  }).then((res) => parseOrThrow<GameState>(res));
}

export function selectSong(id: number): Promise<GameState> {
  return fetch(`/api/songs/${id}/select`, { method: 'POST' }).then((res) => parseOrThrow<GameState>(res));
}

export function createMultiplayerGame(): Promise<CreateGameResponse> {
  return fetch('/games', { method: 'POST' }).then((res) => parseOrThrow<CreateGameResponse>(res));
}

export function fetchGameStatus(gameId: string): Promise<GameSummary> {
  return fetch(`/games/${gameId}`).then((res) => parseOrThrow<GameSummary>(res));
}

export function joinGame(gameId: string, nickname: string, hostToken?: string): Promise<JoinGameResponse> {
  return fetch(`/games/${gameId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, hostToken }),
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
  return `/audio/track?ts=${Date.now()}`;
}

export function multiplayerAudioTrackUrl(gameId: string): string {
  return `/games/${gameId}/audio?ts=${Date.now()}`;
}
