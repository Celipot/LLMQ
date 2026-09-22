import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import Leaderboard from './Leaderboard';
import type { Leaderboards } from '../types';

const emptyBoards: Leaderboards = { nijigasaki: [], mus: [], aqours: [], hasunosora: [], liella: [], ikizulive: [], all: [] };

const boards: Leaderboards = {
  ...emptyBoards,
  nijigasaki: [
    { username: 'Ayumu', turn: 63, score: 18240, grade: 'A' as const },
    { username: 'Kasumi', turn: 41, score: 9000, grade: 'B' as const },
  ],
  aqours: [{ username: 'Chika', turn: 80, score: 30000, grade: 'S' as const }],
};

describe('Leaderboard', () => {
  test('lists the runs of the Nijigasaki board by default, with rank, username, turn, score and grade', () => {
    render(<Leaderboard leaderboards={boards} />);

    const rows = within(screen.getByRole('region', { name: 'Classement du mode Infini' })).getAllByRole('row');
    expect(rows.slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['1', 'Ayumu', '63', '18240', 'A'],
      ['2', 'Kasumi', '41', '9000', 'B'],
    ]);
  });

  test('switches board when another franchise is chosen', async () => {
    render(<Leaderboard leaderboards={boards} />);

    await userEvent.click(screen.getByRole('button', { name: 'Aqours' }));

    expect(screen.getByText('Chika')).toBeInTheDocument();
    expect(screen.queryByText('Ayumu')).not.toBeInTheDocument();
  });

  test('offers a tab for Liella and Ikizulive alongside the other franchises', () => {
    render(<Leaderboard leaderboards={emptyBoards} />);

    expect(screen.getByRole('button', { name: 'Liella' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ikizulive' })).toBeInTheDocument();
  });

  test('says so when nobody has played yet on the current board', () => {
    render(<Leaderboard leaderboards={emptyBoards} />);

    expect(screen.getByText('Aucun score pour le moment.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
