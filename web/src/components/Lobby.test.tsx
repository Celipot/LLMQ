import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import Lobby from './Lobby';

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
});
