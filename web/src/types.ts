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

export type MultiplayerGameStatus = 'lobby' | 'in_progress' | 'ended';

export interface GameSummary {
  gameId: string;
  status: MultiplayerGameStatus;
}

export type PlayerStageStatus = 'active' | 'found' | 'forfeited';

export interface MultiplayerPlayer {
  playerId: string;
  nickname: string;
  status?: PlayerStageStatus;
  forfeitReason?: 'timeout' | 'wrong';
  connected?: boolean;
  returnedToLobby?: boolean;
  totalScore?: number;
}

export interface JoinGameResponse {
  playerId: string;
  players: MultiplayerPlayer[];
}

export interface AnswerFeedback {
  correct: boolean;
}

export interface GameEndedSong {
  title: string;
  artist: string;
  coverUrl: string;
}

export interface GameEndedPlayer {
  playerId: string;
  nickname: string;
  foundStage: number | null;
  score: number;
  // Only present on `song:ended` (the running total across all songs played
  // so far) — the final `game:ended` payload already reports the cumulative
  // total in `score` itself, so this is absent there.
  totalScore?: number;
}

export interface SongCountResponse {
  songCount: number;
}

export interface AnswerWindowResponse {
  answerWindowSeconds: number;
}
