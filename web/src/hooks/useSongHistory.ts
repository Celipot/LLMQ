import { useCallback, useEffect, useState } from 'react';
import type { RoundResult, SongHistory } from '../types';

const HISTORY_KEY = 'songHistory';
const ADAPTIVE_KEY = 'adaptiveDraw';

function readHistory(): SongHistory {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readAdaptive(): boolean {
  try {
    return localStorage.getItem(ADAPTIVE_KEY) !== 'false';
  } catch {
    return true;
  }
}

// Storage can be unavailable (private mode, blocked site data): the draw then
// simply stays uniform, so writes are best-effort.
function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignored on purpose
  }
}

export function useSongHistory() {
  const [history, setHistory] = useState<SongHistory>(readHistory);
  const [adaptive, setAdaptiveState] = useState<boolean>(readAdaptive);

  useEffect(() => {
    persist(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const recordResult = useCallback(({ songId, won, stage }: RoundResult) => {
    setHistory((previous) => {
      const stats = previous[songId] ?? { plays: 0, wins: 0, stageSum: 0, lastPlayedAt: 0 };
      return {
        ...previous,
        [songId]: {
          plays: stats.plays + 1,
          wins: stats.wins + (won ? 1 : 0),
          stageSum: stats.stageSum + (won ? stage : 0),
          lastPlayedAt: Date.now(),
        },
      };
    });
  }, []);

  const clearHistory = useCallback(() => setHistory({}), []);

  const setAdaptive = useCallback((value: boolean) => {
    persist(ADAPTIVE_KEY, String(value));
    setAdaptiveState(value);
  }, []);

  return { history, adaptive, setAdaptive, recordResult, clearHistory };
}
