// Mirrors the shapes returned by server/gameState.js — kept in sync manually
// since the backend has no shared schema/codegen at MVP stage.

export type GuessEntry =
  | { type: 'guess'; title: string; correct: boolean }
  | { type: 'skip'; title: null; correct: null };

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  attemptsUsed: number;
  maxAttempts: number;
  allowedSeconds: number;
  status: GameStatus;
  guesses: GuessEntry[];
  correctTitle?: string;
  correctArtist?: string;
  correctCoverUrl?: string;
}

export type SongStatus = 'not_started' | 'playing' | 'won' | 'lost';

export interface PlayableSong {
  id: number;
  title: string;
  artist: string;
  status: SongStatus;
}

export type ApiErrorCode = 'UNKNOWN_TITLE' | 'TITLE_REQUIRED' | 'GAME_FINISHED' | string;

export interface ApiErrorBody {
  error: ApiErrorCode;
}

export interface GuessResponse {
  correct: boolean;
  state: GameState;
}

export interface SkipResponse {
  state: GameState;
}

export interface CreateGameResponse {
  gameId: string;
  hostToken: string;
}
