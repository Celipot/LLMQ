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
  correctSongId?: number;
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

export type CareerStat = 'oreille' | 'memoire' | 'culture';

export type ReleaseRank = 'S' | 'A' | 'B' | 'C' | 'FAIL';

export interface CareerSong {
  id: number;
  title: string;
  coverUrl: string;
}

export interface Career {
  turn: number;
  totalTurns: number;
  energy: number;
  maxEnergy: number;
  stats: Record<CareerStat, number>;
  suggestionCount: number;
  notebook: CareerSong[];
  releaseDue: boolean;
  release: { rank: ReleaseRank; song: CareerSong } | null;
}

export interface CareerRound {
  kind: 'study' | 'release';
  stat: CareerStat | null;
  state: GameState;
}

export interface CareerResponse {
  career: Career;
  round: CareerRound | null;
}

// A career round ends through the regular guess/skip routes, which then also
// return the career with the round's outcome applied.
export interface GuessResponse {
  correct: boolean;
  state: GameState;
  career?: Career;
}

export interface SkipResponse {
  state: GameState;
  career?: Career;
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
  avatarUrl?: string;
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
  avatarUrl?: string;
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

// Per-song solo results kept in the browser and sent to the server, which
// computes the weights (no comparison/scoring logic on the client).
export interface SongStats {
  plays: number;
  wins: number;
  stageSum: number;
  lastPlayedAt: number;
}

export type SongHistory = Record<number, SongStats>;

export interface RoundResult {
  songId: number;
  won: boolean;
  stage: number;
}

export interface GenerationOption {
  generation: string;
  count: number;
}

export interface GenerationsResponse {
  generations: string[];
}
