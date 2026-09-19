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
    render(<Home onSelectRandom={onSelectRandom} onSelectList={vi.fn()} onGameCreated={vi.fn()} />);

    await userEvent.click(screen.getByText('Mode Solo'));

    expect(onSelectRandom).toHaveBeenCalledOnce();
  });

  test('calls onSelectList when the list mode card is clicked', async () => {
    const onSelectList = vi.fn();
    render(<Home onSelectRandom={vi.fn()} onSelectList={onSelectList} onGameCreated={vi.fn()} />);

    await userEvent.click(screen.getByText('Bibliothèque'));

    expect(onSelectList).toHaveBeenCalledOnce();
  });

  test('calls onGameCreated with the gameId and hostToken after successfully creating a multiplayer game', async () => {
    vi.mocked(api.createMultiplayerGame).mockResolvedValue({ gameId: 'abc123', hostToken: 'token' });
    const onGameCreated = vi.fn();
    render(<Home onSelectRandom={vi.fn()} onSelectList={vi.fn()} onGameCreated={onGameCreated} />);

    await userEvent.click(screen.getByText('Créer une partie multijoueur'));

    await vi.waitFor(() => expect(onGameCreated).toHaveBeenCalledWith('abc123', 'token'));
  });

  test('shows an error message when creating a multiplayer game fails', async () => {
    vi.mocked(api.createMultiplayerGame).mockRejectedValue(new Error('boom'));
    render(<Home onSelectRandom={vi.fn()} onSelectList={vi.fn()} onGameCreated={vi.fn()} />);

    await userEvent.click(screen.getByText('Créer une partie multijoueur'));

    expect(await screen.findByRole('alert')).toHaveTextContent('création de la partie a échoué');
  });

  test('names the modes "Mode Solo" and "Bibliothèque", each with an infinitive description', () => {
    render(<Home onSelectRandom={vi.fn()} onSelectList={vi.fn()} onGameCreated={vi.fn()} />);

    expect(screen.getByText('Choisir un mode pour commencer')).toBeInTheDocument();
    expect(screen.getByText('Mode Solo').closest('button')).toHaveTextContent('Deviner une chanson piochée au hasard');
    expect(screen.getByText('Bibliothèque').closest('button')).toHaveTextContent('Explorer les musiques');
    expect(screen.getByText('Créer une partie multijoueur').closest('button')).toHaveTextContent(
      'Générer un lien à partager avec ses amis'
    );
  });
});
