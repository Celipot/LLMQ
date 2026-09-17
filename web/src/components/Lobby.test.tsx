import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Lobby from './Lobby';
import * as api from '../api';
import { ApiError } from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    startMultiplayerGame: vi.fn(),
  };
});

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Lobby', () => {
  test('renders players received via the lobby:state snapshot', async () => {
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  test('adds a player on player:joined and removes it on player:left', async () => {
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'player:joined', player: { playerId: 'p2', nickname: 'Bob' } });
    expect(await screen.findByText('Bob')).toBeInTheDocument();

    socket.emit({ type: 'player:left', playerId: 'p2' });
    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
  });

  test('does not show the launch button for a non-host player', async () => {
    render(<Lobby gameId="g1" playerId="p1" />);
    expect(screen.queryByText('Lancer la partie')).not.toBeInTheDocument();
  });

  test('shows a disabled launch button for the host with fewer than 2 players', async () => {
    localStorage.setItem('hostToken:g1', 'token');
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });

    expect(await screen.findByText('Lancer la partie')).toBeDisabled();
  });

  test('enables the launch button for the host once at least 2 players are present', async () => {
    localStorage.setItem('hostToken:g1', 'token');
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });

    expect(await screen.findByText('Lancer la partie')).toBeEnabled();
  });

  test('clicking launch calls startMultiplayerGame with the stored hostToken', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    vi.mocked(api.startMultiplayerGame).mockResolvedValue({ status: 'in_progress' });
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });

    await userEvent.click(await screen.findByText('Lancer la partie'));

    expect(api.startMultiplayerGame).toHaveBeenCalledWith('g1', 'the-host-token');
  });

  test('shows an error when launching fails because there are not enough players', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    vi.mocked(api.startMultiplayerGame).mockRejectedValue(new ApiError('NOT_ENOUGH_PLAYERS'));
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });

    await userEvent.click(await screen.findByText('Lancer la partie'));

    expect(await screen.findByRole('alert')).toHaveTextContent('au moins un autre joueur');
  });

  test('shows the starting message once game:started is received', async () => {
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'game:started' });

    expect(await screen.findByText('La partie démarre...')).toBeInTheDocument();
  });

  test('renders GamePlay once stage:start is received', async () => {
    render(<Lobby gameId="g1" playerId="p1" />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'game:started' });
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now() });

    expect(await screen.findByText(/Étape 1/)).toBeInTheDocument();
  });
});
