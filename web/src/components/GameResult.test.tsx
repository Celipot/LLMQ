import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import GameResult from './GameResult';

const SONG = { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/some-song.png' };

describe('GameResult', () => {
  test('reveals the song title, artist and cover', () => {
    render(
      <GameResult
        song={SONG}
        players={[{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 }]}
      />
    );

    expect(screen.getByText(/Some Song — Some Artist/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Some Song' })).toHaveAttribute('src', SONG.coverUrl);
  });

  test('sorts players by score descending', () => {
    render(
      <GameResult
        song={SONG}
        players={[
          { playerId: 'p1', nickname: 'Alice', foundStage: 3, score: 4 },
          { playerId: 'p2', nickname: 'Bob', foundStage: 1, score: 6 },
          { playerId: 'p3', nickname: 'Chris', foundStage: null, score: 0 },
        ]}
      />
    );

    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Bob');
    expect(items[1]).toContain('Alice');
    expect(items[2]).toContain('Chris');
  });

  test('groups tied scores at the same rank without an implied order', () => {
    render(
      <GameResult
        song={SONG}
        players={[
          { playerId: 'p1', nickname: 'Alice', foundStage: 2, score: 5 },
          { playerId: 'p2', nickname: 'Bob', foundStage: 2, score: 5 },
          { playerId: 'p3', nickname: 'Chris', foundStage: 4, score: 3 },
        ]}
      />
    );

    expect(screen.getByText(/^#1 Alice/)).toBeInTheDocument();
    expect(screen.getByText(/^#1 Bob/)).toBeInTheDocument();
    expect(screen.getByText(/^#3 Chris/)).toBeInTheDocument();
  });

  test("shows each player's picture to the left of their rank", () => {
    render(
      <GameResult
        song={SONG}
        players={[
          { playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6, avatarUrl: '/games/g1/players/p1/avatar' },
          { playerId: 'p2', nickname: 'Bob', foundStage: null, score: 0 },
        ]}
      />
    );

    const aliceRow = screen.getByText(/Alice/).closest('li') as HTMLElement;
    const bobRow = screen.getByText(/Bob/).closest('li') as HTMLElement;
    expect(aliceRow.firstElementChild).toHaveAttribute('src', '/games/g1/players/p1/avatar');
    expect(bobRow.querySelector('.player-avatar-fallback')).toBeInTheDocument();
  });
});
