import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';
import * as api from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    fetchState: vi.fn(),
    fetchTitles: vi.fn(),
    fetchGameStatus: vi.fn(),
    fetchGenerations: vi.fn(),
    startRandomMode: vi.fn(),
  };
});

class MockWebSocket {
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  send() {}
  close() {}
}

beforeEach(() => {
  vi.mocked(api.fetchState).mockResolvedValue({
    attemptsUsed: 0,
    maxAttempts: 6,
    allowedSeconds: 1,
    status: 'playing',
    guesses: [],
  });
  vi.mocked(api.fetchTitles).mockResolvedValue([]);
  vi.mocked(api.fetchGenerations).mockResolvedValue([
    { generation: 'Aqours', count: 189 },
    { generation: 'Liella', count: 145 },
  ]);
  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

describe('App — Random mode generation filter', () => {
  test('choosing Mode Aléatoire shows the generation filter before starting any round', async () => {
    render(<App />);

    await userEvent.click(await screen.findByText('Mode Aléatoire'));

    expect(await screen.findByRole('checkbox', { name: /Aqours/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Liella/ })).toBeChecked();
    expect(api.startRandomMode).not.toHaveBeenCalled();
  });

  test('Lancer starts the round with the checked generations only', async () => {
    vi.mocked(api.startRandomMode).mockResolvedValue({
      attemptsUsed: 0,
      maxAttempts: 6,
      allowedSeconds: 1,
      status: 'playing',
      guesses: [],
    });
    render(<App />);

    await userEvent.click(await screen.findByText('Mode Aléatoire'));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Aqours/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    await waitFor(() => expect(api.startRandomMode).toHaveBeenCalledWith(['Liella']));
  });
});

describe('App — MP-13 session persistence', () => {
  test('shows the join screen for a game link when no playerId is persisted', async () => {
    window.history.pushState({}, '', '/game/g1');
    vi.mocked(api.fetchGameStatus).mockResolvedValue({ gameId: 'g1', status: 'lobby' });

    render(<App />);

    expect(await screen.findByText('Rejoins la partie')).toBeInTheDocument();
  });

  test('skips straight to the lobby when a playerId is already persisted for that game', async () => {
    window.history.pushState({}, '', '/game/g1');
    localStorage.setItem('playerId:g1', 'p1');

    render(<App />);

    expect(screen.queryByText('Rejoins la partie')).not.toBeInTheDocument();
    expect(await screen.findByText('En attente du lancement de la partie...')).toBeInTheDocument();
  });
});
