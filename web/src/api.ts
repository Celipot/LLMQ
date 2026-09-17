import type { ApiErrorBody, GameState, GuessResponse, PlayableSong, SkipResponse } from './types';

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

export function startRandomMode(): Promise<GameState> {
  return fetch('/api/mode/random', { method: 'POST' }).then((res) => parseOrThrow<GameState>(res));
}

export function selectSong(id: number): Promise<GameState> {
  return fetch(`/api/songs/${id}/select`, { method: 'POST' }).then((res) => parseOrThrow<GameState>(res));
}

export function audioTrackUrl(): string {
  // Cache-busted: the allowed duration may have changed since the last fetch,
  // and the server is the only source of truth for how much audio is served.
  return `/audio/track?ts=${Date.now()}`;
}
