import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import JoinGame from './JoinGame';
import * as api from '../api';
import { ApiError } from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    fetchGameStatus: vi.fn(),
    joinGame: vi.fn(),
  };
});

describe('JoinGame', () => {
  test('shows the nickname form when the game is joinable', async () => {
    vi.mocked(api.fetchGameStatus).mockResolvedValue({ gameId: 'g1', status: 'lobby' });
    render(<JoinGame gameId="g1" onJoined={vi.fn()} />);

    expect(await screen.findByLabelText('Pseudo')).toBeInTheDocument();
  });

  test('joins the game and calls onJoined with the playerId on success', async () => {
    vi.mocked(api.fetchGameStatus).mockResolvedValue({ gameId: 'g1', status: 'lobby' });
    vi.mocked(api.joinGame).mockResolvedValue({ playerId: 'p1', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    const onJoined = vi.fn();
    render(<JoinGame gameId="g1" onJoined={onJoined} />);

    await userEvent.type(await screen.findByLabelText('Pseudo'), 'Alice');
    await userEvent.click(screen.getByText('Rejoindre'));

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('p1'));
  });

  test('shows an error asking for another nickname when it is already taken', async () => {
    vi.mocked(api.fetchGameStatus).mockResolvedValue({ gameId: 'g1', status: 'lobby' });
    vi.mocked(api.joinGame).mockRejectedValue(new ApiError('NICKNAME_TAKEN'));
    render(<JoinGame gameId="g1" onJoined={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText('Pseudo'), 'Alice');
    await userEvent.click(screen.getByText('Rejoindre'));

    expect(await screen.findByRole('alert')).toHaveTextContent('déjà pris');
  });

  test('shows a locked message when the linked game already started', async () => {
    vi.mocked(api.fetchGameStatus).mockResolvedValue({ gameId: 'g1', status: 'in_progress' });
    render(<JoinGame gameId="g1" onJoined={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('déjà commencé');
  });

  test('shows a not-found message for an unknown game', async () => {
    vi.mocked(api.fetchGameStatus).mockRejectedValue(new ApiError('GAME_NOT_FOUND'));
    render(<JoinGame gameId="g1" onJoined={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent("n'existe pas");
  });
});
