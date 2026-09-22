import { useEffect, useState } from 'react';
import { fetchLeaderboards } from '../api';
import type { Leaderboards } from '../types';

const EMPTY_BOARDS: Leaderboards = { nijigasaki: [], mus: [], aqours: [], hasunosora: [], liella: [], ikizulive: [], all: [] };

// Read again each time the leaderboard is about to be shown, since other players
// keep playing.
export function useLeaderboard(enabled: boolean): Leaderboards {
  const [boards, setBoards] = useState<Leaderboards>(EMPTY_BOARDS);

  useEffect(() => {
    if (!enabled) return;
    fetchLeaderboards()
      .then(setBoards)
      .catch(() => {});
  }, [enabled]);

  return boards;
}
