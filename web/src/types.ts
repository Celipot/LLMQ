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
  // Last turn of the second phase (concert) and of the third one (finale).
  concertAt: number;
  finalTurn: number;
  releaseAt: number;
  mode: CareerMode;
  // The infinite mode repeats the third phase: 1 for the first one, then 2, 3...
  cycle: number;
  // Every finale played, the last of a classic career included.
  finales: CareerResult[];
  energy: number;
  maxEnergy: number;
  // Effective stats: a temporary penalty can push one under 0.
  stats: Record<CareerStat, number>;
  // A stat keeps growing past its maximum, its bar is then shown full.
  statMax: Record<CareerStat, number>;
  modifiers: CareerModifier[];
  suggestionCount: number;
  unit: Unit;
  // The franchise being followed: derived from the unit in a classic career, chosen
  // directly (or 'all', the whole library) in the infinite mode.
  generation: Generation;
  difficulty: Difficulty;
  // The clip length in seconds of each try, and the search suggestions, before any stat bonus.
  baseTiers: number[];
  baseSuggestions: number;
  costs: { study: number; single: number };
  statStep: number;
  notebook: CareerSong[];
  releaseDue: boolean;
  album: { done: number; total: number };
  release: CareerResult | null;
  concertDue: boolean;
  concert: { done: number; total: number };
  concertResult: CareerResult | null;
  fans: { current: number; required: number };
  // Why the career ended early, null while it is going on or once the concert is over.
  failure: CareerFailure | null;
  albumGoalGrade: CareerGrade;
  // Only once the career is over (finale played or failure).
  finalScore: CareerScore | null;
  // Third phase: albums and concerts on demand, then the finale.
  phase3: boolean;
  sorties: CareerSortie[];
  liveCosts: { album: number; concert: number };
  // The album, concert or finale being played track by track.
  live: { kind: CareerSortieKind | 'finale'; done: number; total: number } | null;
  finaleGoals: FinaleGoals;
  finaleDue: boolean;
  finaleResult: CareerResult | null;
  events: CareerEventRecord[];
  // Fired by the last action, shown one after the other.
  newEvents: CareerEvent[];
  // Set while the player has to choose the reward of a series.
  pendingChoice: PendingChoice | null;
}

export interface CareerModifier {
  stat: CareerStat;
  delta: number;
  expiresAtTurn: number;
}

export interface CareerEvent {
  id: number;
  text: string;
  // The titles a notebook gain added, so the player knows which ones.
  gained?: CareerSong[];
}

export interface CareerEventRecord extends CareerEvent {
  turn: number;
}

export type RewardOption = 'stats' | 'energy';

export interface PendingChoice {
  eventId: number;
  options: Record<RewardOption, { amount: number }>;
}

export type CareerSortieKind = 'album' | 'concert';

export interface CareerSortie extends CareerResult {
  kind: CareerSortieKind;
}

interface FinaleGoal {
  done: number;
  good: number;
  required: number;
  requiredGood: number;
}

export interface FinaleGoals {
  concerts: FinaleGoal;
  albums: FinaleGoal;
  met: boolean;
}

export interface CareerScore {
  album: number;
  concert: number;
  sorties: number;
  finale: number;
  stats: number;
  fans: number;
  total: number;
  grade: CareerGrade;
}

export type CareerFailure = 'ALBUM_GRADE' | 'FANS' | 'FINALE_GOALS' | 'FINALE_SCORE';

export type CareerGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CareerTrack {
  song: CareerSong;
  rank: ReleaseRank;
  points: number;
}

// Only present once the last track of the album (release) or of the concert
// (concertResult) is played; the concert ends the career.
export interface CareerResult {
  score: number;
  maxScore: number;
  grade: CareerGrade;
  // The turn the release is dated with, shown in the career history.
  turn: number;
  tracks: CareerTrack[];
}

export type Difficulty = 'normal' | 'hard';

export type CareerMode = 'classic' | 'infinite';

// A classic career follows a unit at a difficulty; an infinite one needs a username for the
// leaderboard and follows a franchise ('all' is the whole library, nijigasaki the default).
export type CareerChoice =
  | { unit: Unit; difficulty: Difficulty }
  | { mode: 'infinite'; username: string; generation?: Generation };

export interface LeaderboardEntry {
  username: string;
  turn: number;
  score: number;
  grade: CareerGrade;
}

// One leaderboard per franchise, plus 'all' for the whole library.
export type Leaderboards = Record<Generation, LeaderboardEntry[]>;

export type Unit =
  | 'azuna'
  | 'diverdiva'
  | 'qu4rtz'
  | 'r3birth'
  | 'printemps'
  | 'lilywhite'
  | 'bibi'
  | 'cyaron'
  | 'azalea'
  | 'guiltykiss'
  | 'cerisebouquet'
  | 'dollchestra'
  | 'miracrapark'
  | 'edelnote'
  | 'catchu'
  | 'syncrise'
  | 'kaleidoscore'
  | 'ikizuraibu';

// The 6 franchises playable in career, plus 'all' (only valid for the infinite mode).
export type Generation = 'nijigasaki' | 'mus' | 'aqours' | 'hasunosora' | 'liella' | 'ikizulive' | 'all';

// The kind of title to guess; a unit or a group has no singer.
export interface TitleHint {
  group: string;
  singer?: string;
}

export interface CareerRound {
  kind: 'study' | 'single' | 'release' | 'concert' | 'finale';
  stat: CareerStat | null;
  inNotebook: boolean;
  // Only on the normal difficulty.
  hint?: TitleHint;
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
