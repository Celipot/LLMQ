import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Result from './Result';
import type { GameState } from '../types';

const WON: GameState = {
  attemptsUsed: 3,
  maxAttempts: 6,
  allowedSeconds: 4,
  status: 'won',
  guesses: [],
  correctSongId: 5,
  correctTitle: 'Snow halation',
  correctArtist: "µ's",
  correctCoverUrl: '/covers/2_snowhalation.png',
};

describe('Result', () => {
  test('announces a win with the cover, the song and the attempts used', () => {
    render(<Result state={WON} />);

    expect(screen.getByRole('heading', { name: 'Gagné !' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Snow halation' })).toHaveAttribute('src', '/covers/2_snowhalation.png');
    expect(screen.getByText("La chanson était : Snow halation — µ's")).toBeInTheDocument();
    expect(screen.getByText('Essais utilisés : 3 / 6')).toBeInTheDocument();
  });

  test('announces a loss', () => {
    render(<Result state={{ ...WON, status: 'lost', attemptsUsed: 6 }} />);

    expect(screen.getByRole('heading', { name: 'Perdu' })).toBeInTheDocument();
  });

  test('shows no button when no action is provided', () => {
    render(<Result state={WON} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('"Musique suivante" triggers the next song', async () => {
    const onNextSong = vi.fn();
    render(<Result state={WON} onNextSong={onNextSong} onHome={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Musique suivante' }));

    expect(onNextSong).toHaveBeenCalledTimes(1);
  });

  test('"Accueil" goes back home', async () => {
    const onHome = vi.fn();
    render(<Result state={WON} onNextSong={vi.fn()} onHome={onHome} />);

    await userEvent.click(screen.getByRole('button', { name: 'Accueil' }));

    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
