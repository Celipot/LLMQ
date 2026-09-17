import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Home from './Home';
import * as api from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    createMultiplayerGame: vi.fn(),
  };
});

describe('Home', () => {
  test('calls onSelectRandom when the random mode card is clicked', async () => {
    const onSelectRandom = vi.fn();
    render(<Home onSelectRandom={onSelectRandom} onSelectList={vi.fn()} />);

    await userEvent.click(screen.getByText('Mode Aléatoire'));

    expect(onSelectRandom).toHaveBeenCalledOnce();
  });

  test('calls onSelectList when the list mode card is clicked', async () => {
    const onSelectList = vi.fn();
    render(<Home onSelectRandom={vi.fn()} onSelectList={onSelectList} />);

    await userEvent.click(screen.getByText('Mode Liste'));

    expect(onSelectList).toHaveBeenCalledOnce();
  });

  test('shows the game link after successfully creating a multiplayer game', async () => {
    vi.mocked(api.createMultiplayerGame).mockResolvedValue({ gameId: 'abc123', hostToken: 'token' });
    render(<Home onSelectRandom={vi.fn()} onSelectList={vi.fn()} />);

    await userEvent.click(screen.getByText('Créer une partie multijoueur'));

    expect(await screen.findByText('/game/abc123')).toBeInTheDocument();
  });

  test('shows an error message when creating a multiplayer game fails', async () => {
    vi.mocked(api.createMultiplayerGame).mockRejectedValue(new Error('boom'));
    render(<Home onSelectRandom={vi.fn()} onSelectList={vi.fn()} />);

    await userEvent.click(screen.getByText('Créer une partie multijoueur'));

    expect(await screen.findByRole('alert')).toHaveTextContent('création de la partie a échoué');
  });
});
