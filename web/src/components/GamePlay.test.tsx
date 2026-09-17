import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import GamePlay from './GamePlay';

describe('GamePlay', () => {
  test('renders the stage number and the bounded duration', () => {
    render(<GamePlay gameId="g1" stage={2} durationSeconds={4} />);

    expect(screen.getByText(/Étape 2/)).toBeInTheDocument();
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });

  test('points the audio element at the game-scoped multiplayer track once play is clicked', async () => {
    render(<GamePlay gameId="g1" stage={1} durationSeconds={1} />);

    await userEvent.click(screen.getByRole('button', { name: 'Écouter' }));

    const audio = document.querySelector('audio');
    expect(audio?.src).toContain('/games/g1/audio');
  });
});
