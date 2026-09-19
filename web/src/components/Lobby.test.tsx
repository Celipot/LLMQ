import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    fetchTitles: vi.fn(),
    updateSongCount: vi.fn(),
    updateAnswerWindow: vi.fn(),
    fetchGenerations: vi.fn(),
    updateGenerations: vi.fn(),
  };
});

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  closed = false;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  triggerClose(code = 1006) {
    this.closed = true;
    this.onclose?.({ code });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  localStorage.clear();
  vi.mocked(api.fetchTitles).mockResolvedValue([]);
  vi.mocked(api.updateSongCount).mockResolvedValue({ songCount: 1 });
  vi.mocked(api.updateAnswerWindow).mockResolvedValue({ answerWindowSeconds: 60 });
  vi.mocked(api.fetchGenerations).mockResolvedValue([
    { generation: 'Aqours', count: 189 },
    { generation: 'Liella', count: 145 },
  ]);
  vi.mocked(api.updateGenerations).mockResolvedValue({ generations: ['Aqours', 'Liella'] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Lobby', () => {
  test('renders players received via the lobby:state snapshot', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });

    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  test('adds a player on player:joined and removes it on player:left', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'player:joined', player: { playerId: 'p2', nickname: 'Bob' } });
    expect(await screen.findByText('Bob')).toBeInTheDocument();

    socket.emit({ type: 'player:left', playerId: 'p2' });
    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
  });

  test('does not duplicate a player who reconnects (repeated player:joined for the same playerId)', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'player:joined', player: { playerId: 'p2', nickname: 'Bob' } });
    await screen.findByText('Bob');
    socket.emit({ type: 'player:joined', player: { playerId: 'p2', nickname: 'Bob' } });

    expect(await screen.findAllByText('Bob')).toHaveLength(1);
  });

  test('does not show the launch button for a non-host player', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByText('Lancer la partie')).not.toBeInTheDocument();
  });

  test('becomes host and persists the new hostToken on host:transferred', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    expect(screen.queryByText('Lancer la partie')).not.toBeInTheDocument();

    socket.emit({ type: 'host:transferred', hostToken: 'new-token' });

    expect(await screen.findByText('Lancer la partie')).toBeEnabled();
    expect(localStorage.getItem('hostToken:g1')).toBe('new-token');
  });

  test('enables the launch button for the host alone in the lobby (solo)', async () => {
    localStorage.setItem('hostToken:g1', 'token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });

    expect(await screen.findByText('Lancer la partie')).toBeEnabled();
  });

  test('enables the launch button for the host once at least 2 players are present', async () => {
    localStorage.setItem('hostToken:g1', 'token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
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
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
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
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
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

  test('shows the host-chosen song count as read-only text for a non-host player', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }], songCount: 7 });

    expect(await screen.findByText('Nombre de musiques : 7')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  test('the host can edit the song count, which calls updateSongCount', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }], songCount: 1 });
    await screen.findByText('Alice');

    const input = screen.getByRole('spinbutton', { name: /Nombre de musiques/ });
    fireEvent.change(input, { target: { value: '25' } });

    await waitFor(() => expect(api.updateSongCount).toHaveBeenCalledWith('g1', 'the-host-token', 25));
  });

  test('clamps the song count to the 1-100 range for the host', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }], songCount: 1 });
    await screen.findByText('Alice');

    const input = screen.getByRole('spinbutton', { name: /Nombre de musiques/ });
    fireEvent.change(input, { target: { value: '250' } });

    await waitFor(() => expect(api.updateSongCount).toHaveBeenCalledWith('g1', 'the-host-token', 100));
  });

  test('updates the displayed song count for everyone on lobby:songCount', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }], songCount: 1 });
    await screen.findByText('Nombre de musiques : 1');

    socket.emit({ type: 'lobby:songCount', songCount: 12 });

    expect(await screen.findByText('Nombre de musiques : 12')).toBeInTheDocument();
  });

  test('shows the host-chosen answer window as read-only text for a non-host player', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      answerWindowSeconds: 45,
    });

    expect(await screen.findByText('Temps pour deviner : 45s')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  describe('answer window field (host)', () => {
    async function renderAsHost(answerWindowSeconds = 60) {
      localStorage.setItem('hostToken:g1', 'the-host-token');
      render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
      const socket = MockWebSocket.instances[0];
      socket.emit({
        type: 'lobby:state',
        players: [{ playerId: 'p1', nickname: 'Alice' }],
        answerWindowSeconds,
      });
      await screen.findByText('Alice');
      return { socket, input: screen.getByRole('spinbutton', { name: /Temps pour deviner/ }) };
    }

    test('is a number field capped at 300 seconds, not a slider', async () => {
      const { input } = await renderAsHost(60);

      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
      expect(input).toHaveValue(60);
      expect(input).toHaveAttribute('max', '300');
    });

    test('sends the typed value once the field loses focus', async () => {
      const { input } = await renderAsHost();

      await userEvent.clear(input);
      await userEvent.type(input, '90');
      await userEvent.tab();

      await waitFor(() => expect(api.updateAnswerWindow).toHaveBeenCalledWith('g1', 'the-host-token', 90));
    });

    test('sends the typed value on Enter', async () => {
      const { input } = await renderAsHost();

      await userEvent.clear(input);
      await userEvent.type(input, '45{Enter}');

      await waitFor(() => expect(api.updateAnswerWindow).toHaveBeenCalledWith('g1', 'the-host-token', 45));
    });

    test('lets the host type a value below the minimum without rewriting it while typing', async () => {
      const { input } = await renderAsHost();

      await userEvent.clear(input);
      await userEvent.type(input, '4');

      expect(input).toHaveValue(4);
      expect(api.updateAnswerWindow).not.toHaveBeenCalled();
    });

    test('caps a value above 300 to 300', async () => {
      const { input } = await renderAsHost();

      await userEvent.clear(input);
      await userEvent.type(input, '9000');
      await userEvent.tab();

      await waitFor(() => expect(api.updateAnswerWindow).toHaveBeenCalledWith('g1', 'the-host-token', 300));
      expect(input).toHaveValue(300);
    });

    test('raises a value below 10 to 10', async () => {
      const { input } = await renderAsHost();

      await userEvent.clear(input);
      await userEvent.type(input, '5');
      await userEvent.tab();

      await waitFor(() => expect(api.updateAnswerWindow).toHaveBeenCalledWith('g1', 'the-host-token', 10));
      expect(input).toHaveValue(10);
    });

    test('goes back to the previous value when the field is left empty', async () => {
      const { input } = await renderAsHost(60);

      await userEvent.clear(input);
      await userEvent.tab();

      expect(input).toHaveValue(60);
      expect(api.updateAnswerWindow).not.toHaveBeenCalled();
    });

    test('shows the value chosen elsewhere on lobby:answerWindow', async () => {
      const { socket, input } = await renderAsHost(60);

      socket.emit({ type: 'lobby:answerWindow', answerWindowSeconds: 45 });

      await waitFor(() => expect(input).toHaveValue(45));
    });
  });

  test('updates the displayed answer window for everyone on lobby:answerWindow', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      answerWindowSeconds: 60,
    });
    await screen.findByText('Temps pour deviner : 60s');

    socket.emit({ type: 'lobby:answerWindow', answerWindowSeconds: 45 });

    expect(await screen.findByText('Temps pour deviner : 45s')).toBeInTheDocument();
  });

  test('shows the allowed generations as read-only checkboxes for a non-host player', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      generations: ['Aqours'],
    });

    const aqours = await screen.findByRole('checkbox', { name: /Aqours/ });
    expect(aqours).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Liella/ })).not.toBeChecked();
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
  });

  test('the host can check a generation, which calls updateGenerations', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      generations: ['Aqours'],
    });

    await userEvent.click(await screen.findByRole('checkbox', { name: /Liella/ }));

    await waitFor(() =>
      expect(api.updateGenerations).toHaveBeenCalledWith('g1', 'the-host-token', ['Aqours', 'Liella'])
    );
  });

  test('shows an error when updating the generations fails', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    vi.mocked(api.updateGenerations).mockRejectedValue(new ApiError('NOT_HOST'));
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      generations: ['Aqours'],
    });

    await userEvent.click(await screen.findByRole('checkbox', { name: /Liella/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de mettre à jour les générations.');
  });

  test('updates the checked generations for everyone on lobby:generations', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      generations: ['Aqours', 'Liella'],
    });
    await screen.findByRole('checkbox', { name: /Liella/ });

    socket.emit({ type: 'lobby:generations', generations: ['Liella'] });

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Aqours/ })).not.toBeChecked());
    expect(screen.getByRole('checkbox', { name: /Liella/ })).toBeChecked();
  });

  test('back in the lobby after game:reset, the checked generations are the ones the server sent', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({
      type: 'game:reset',
      players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }],
      generations: ['Liella'],
    });

    expect(await screen.findByRole('checkbox', { name: /Liella/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Aqours/ })).not.toBeChecked();
  });

  test('shows the starting message once game:started is received', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'game:started' });

    expect(await screen.findByText('La partie démarre...')).toBeInTheDocument();
  });

  test('renders GamePlay once stage:start is received', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'game:started' });
    socket.emit({
      type: 'stage:start', maxStage: 6,
      stage: 1,
      durationSeconds: 1,
      serverTimestamp: Date.now(),
      answerWindowMs: 30000,
      nextDurationSeconds: 2,
    });

    expect(await screen.findByText(/Étape 1/)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 30s');
    expect(screen.getByText(/Étape 1/).closest('p')).toHaveTextContent('Étape 1 sur 61s');
    expect(screen.getByText('(étape suivante — 2s)')).toBeInTheDocument();
  });

  test('sends answer:submit over the socket and shows the result once received', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    const input = await screen.findByRole('textbox');
    await userEvent.type(input, 'Some Title');
    await userEvent.click(screen.getByText('Valider'));

    expect(socket.sent).toContainEqual(JSON.stringify({ type: 'answer:submit', value: 'Some Title' }));
    expect(await screen.findByText('En attente du serveur…')).toBeInTheDocument();
    expect(screen.getByText('Valider…')).toBeDisabled();

    socket.emit({ type: 'answer:result', correct: true });

    expect(await screen.findByText('Bravo, tu as trouvé !')).toBeInTheDocument();
    expect(screen.queryByText('En attente du serveur…')).not.toBeInTheDocument();
  });

  test('sends stage:forfeit over the socket and shows the forfeited message once acknowledged', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    await userEvent.click(screen.getByText('Abandonner cette étape'));

    expect(socket.sent).toContainEqual(JSON.stringify({ type: 'stage:forfeit' }));
    expect(await screen.findByText('En attente du serveur…')).toBeInTheDocument();

    socket.emit({ type: 'player:status', playerId: 'p1', status: 'forfeited', stage: 1 });

    expect(await screen.findByText('Tu as abandonné cette étape.')).toBeInTheDocument();
    expect(screen.queryByText('En attente du serveur…')).not.toBeInTheDocument();
  });

  test('reflects another player found/forfeited status live during the stage', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice', status: 'active' },
        { playerId: 'p2', nickname: 'Bob', status: 'active' },
      ],
    });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    expect((await screen.findByText('Bob')).closest('li')).toHaveTextContent('Bob — cherche encore');

    socket.emit({ type: 'player:status', playerId: 'p2', status: 'found', stage: 1 });

    expect(await screen.findByText('a trouvé')).toBeInTheDocument();
  });

  test('reflects its own found status in the shared player list once answer:result arrives', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    socket.emit({ type: 'answer:result', correct: true });

    expect(await screen.findByText('a trouvé')).toBeInTheDocument();
  });

  test('marks a player who guessed wrong as "s\'est trompé", then active again on the next stage', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    socket.emit({ type: 'answer:result', correct: false });
    socket.emit({ type: 'player:status', playerId: 'p1', status: 'forfeited', stage: 1, reason: 'wrong' });

    expect(await screen.findByText("s'est trompé")).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();

    socket.emit({ type: 'stage:start', maxStage: 6, stage: 2, durationSeconds: 2, serverTimestamp: Date.now(), answerWindowMs: 30000 });

    expect((await screen.findByText('Alice')).closest('li')).toHaveTextContent('Alice — cherche encore');
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  test('does not reset a found player back to active when the stage advances', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);
    socket.emit({ type: 'answer:result', correct: true });
    await screen.findByText('a trouvé');

    socket.emit({ type: 'stage:start', maxStage: 6, stage: 2, durationSeconds: 2, serverTimestamp: Date.now(), answerWindowMs: 30000 });

    await screen.findByText(/Étape 2/);
    expect(screen.getByText('a trouvé')).toBeInTheDocument();
  });

  test('keeps the answer controls locked for a player who found the song when the stage advances', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);
    socket.emit({ type: 'answer:result', correct: true });
    await screen.findByText('a trouvé');

    socket.emit({ type: 'stage:start', maxStage: 6, stage: 2, durationSeconds: 2, serverTimestamp: Date.now(), answerWindowMs: 30000 });

    await screen.findByText(/Étape 2/);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Abandonner/ })).toBeDisabled();
  });

  test('unlocks the answer controls of a player who found the song once the next song starts', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 1, songCount: 2 });
    await screen.findByText(/Étape 1/);
    socket.emit({ type: 'answer:result', correct: true });
    await screen.findByText('a trouvé');

    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 2, songCount: 2 });

    expect((await screen.findByText('Alice')).closest('li')).toHaveTextContent('Alice — cherche encore');
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  test('shows no previous-song banner on song:ended, keeps the running score and starts the next song on the following stage:start', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 1, songCount: 2 });
    await screen.findByText(/Musique 1\/2/);

    socket.emit({
      type: 'song:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6, totalScore: 6 }],
      songIndex: 1,
      songCount: 2,
    });

    expect((await screen.findByText('Alice')).closest('li')).toHaveTextContent('6 pts');
    expect(screen.queryByText(/Some Song — Some Artist/)).not.toBeInTheDocument();

    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 2, songCount: 2 });

    expect(await screen.findByText(/Musique 2\/2/)).toBeInTheDocument();
    expect(screen.getByText('Alice').closest('li')).toHaveTextContent('6 pts');
  });

  test('renders GameResult once game:ended is received', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    socket.emit({
      type: 'game:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 }],
    });

    expect(await screen.findByText(/Some Song — Some Artist/)).toBeInTheDocument();
  });

  test('reconnects automatically after an unexpected close and resyncs via game:state', async () => {
    vi.useFakeTimers();
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const firstSocket = MockWebSocket.instances[0];
    firstSocket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });

    firstSocket.triggerClose(1006);
    await vi.advanceTimersByTimeAsync(2000);

    expect(MockWebSocket.instances.length).toBe(2);
    const secondSocket = MockWebSocket.instances[1];
    secondSocket.emit({
      type: 'game:state',
      status: 'in_progress',
      stage: 2,
      maxStage: 6,
      durationSeconds: 2,
      remainingMs: 10000,
      players: [{ playerId: 'p1', nickname: 'Alice', status: 'found' }],
    });

    vi.useRealTimers();
    expect(await screen.findByText(/Étape 2/)).toBeInTheDocument();
    expect(await screen.findByText('a trouvé')).toBeInTheDocument();
    // The countdown is seeded from the server's authoritative remainingMs on
    // resync, not restarted at a full answer window.
    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 10s');
  });

  test('restores the song history and running scores from a game:state resync', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];

    socket.emit({
      type: 'game:state',
      status: 'in_progress',
      stage: 1,
      maxStage: 6,
      durationSeconds: 1,
      remainingMs: 10000,
      songIndex: 3,
      songCount: 5,
      players: [{ playerId: 'p1', nickname: 'Alice', status: 'active', totalScore: 9 }],
      playedSongs: [
        { title: 'First Song', artist: 'Artist A', coverUrl: '/covers/a.png' },
        { title: 'Second Song', artist: 'Artist B', coverUrl: '/covers/b.png' },
      ],
    });

    const history = (await screen.findByText('Historique')).closest('aside');
    expect(history).toHaveTextContent('First Song');
    expect(history).toHaveTextContent('Second Song');
    expect(screen.getByText('Alice').closest('li')).toHaveTextContent('9 pts');
  });

  test('a game:state resync replaces the local history instead of duplicating it', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    socket.emit({
      type: 'song:ended',
      song: { title: 'First Song', artist: 'Artist A', coverUrl: '/covers/a.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6, totalScore: 6 }],
    });
    await screen.findByText('Historique');

    socket.emit({
      type: 'game:state',
      status: 'in_progress',
      stage: 2,
      maxStage: 6,
      durationSeconds: 2,
      remainingMs: 10000,
      players: [{ playerId: 'p1', nickname: 'Alice', status: 'active', totalScore: 6 }],
      playedSongs: [{ title: 'First Song', artist: 'Artist A', coverUrl: '/covers/a.png' }],
    });

    await screen.findByText(/Étape 2/);
    expect(screen.getAllByText('First Song')).toHaveLength(1);
  });

  test('calls onSessionInvalid and does not retry when the socket closes with code 4004', async () => {
    const onSessionInvalid = vi.fn();
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={onSessionInvalid} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];

    socket.triggerClose(4004);

    expect(onSessionInvalid).toHaveBeenCalledOnce();
  });

  test('reflects a live player:connection update in GamePlay', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice', status: 'active' },
        { playerId: 'p2', nickname: 'Bob', status: 'active' },
      ],
    });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    socket.emit({ type: 'player:connection', playerId: 'p2', connected: false });

    expect((await screen.findByText('Bob')).closest('li')).toHaveTextContent('(déconnecté)');
  });

  test('clicking "Quitter la partie" in the waiting room sends player:leave and calls onLeave', async () => {
    const onLeave = vi.fn();
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={onLeave} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    await userEvent.click(screen.getByText('Quitter la partie'));

    expect(socket.sent).toContainEqual(JSON.stringify({ type: 'player:leave' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  test('shows a song in the history sidebar once a song:ended arrives during a stage', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);
    socket.emit({
      type: 'song:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6, totalScore: 6 }],
    });
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    const history = screen.getByText('Historique').closest('aside');
    expect(history).toHaveTextContent('Some Song');
    expect(history).toHaveTextContent('Some Artist');
  });

  test('accumulates multiple song:ended entries in the history and resets it on game:reset', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);
    socket.emit({
      type: 'song:ended',
      song: { title: 'First Song', artist: 'Artist A', coverUrl: '/covers/a.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6, totalScore: 6 }],
    });
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 2 });
    await screen.findByText(/Musique 2/);
    socket.emit({
      type: 'song:ended',
      song: { title: 'Second Song', artist: 'Artist B', coverUrl: '/covers/b.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 4, totalScore: 10 }],
    });
    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 3 });
    await screen.findByText(/Musique 3/);

    const history = screen.getByText('Historique').closest('aside');
    expect(history).toHaveTextContent('First Song');
    expect(history).toHaveTextContent('Second Song');

    socket.emit({ type: 'game:ended', song: { title: 'Second Song', artist: 'Artist B', coverUrl: '/covers/b.png' }, players: [] });
    await screen.findByText(/Second Song — Artist B/);
    await userEvent.click(screen.getByText('Retour au lobby'));
    socket.emit({ type: 'game:reset', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('En attente du lancement de la partie...');

    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 1 });
    await screen.findByText(/Étape 1/);

    expect(screen.queryByText('Historique')).not.toBeInTheDocument();
  });

  test('clicking "Retour au lobby" sends player:returnToLobby and navigates only this client back to the lobby', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({
      type: 'game:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 }],
    });
    await screen.findByText(/Some Song — Some Artist/);

    await userEvent.click(screen.getByText('Retour au lobby'));

    expect(socket.sent).toContainEqual(JSON.stringify({ type: 'player:returnToLobby' }));
    expect(await screen.findByText('En attente du lancement de la partie...')).toBeInTheDocument();
  });

  test('game:reset after a full game (stage:start then game:ended) shows the lobby, not GamePlay again', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({
      type: 'stage:start', maxStage: 6,
      stage: 1,
      durationSeconds: 1,
      serverTimestamp: Date.now(),
      answerWindowMs: 30000,
    });
    await screen.findByText(/Étape 1/);
    socket.emit({
      type: 'game:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 }],
    });
    await screen.findByText(/Some Song — Some Artist/);

    await userEvent.click(screen.getByText('Retour au lobby'));
    socket.emit({ type: 'game:reset', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });

    expect(await screen.findByText('En attente du lancement de la partie...')).toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  test('a game:reset from another player does not navigate this client away from the results screen', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });
    await screen.findByText('Alice');
    socket.emit({
      type: 'game:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [
        { playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 },
        { playerId: 'p2', nickname: 'Bob', foundStage: null, score: 0 },
      ],
    });
    await screen.findByText(/Some Song — Some Artist/);

    socket.emit({
      type: 'game:reset',
      players: [
        { playerId: 'p1', nickname: 'Alice', status: 'active', returnedToLobby: false },
        { playerId: 'p2', nickname: 'Bob', status: 'active', returnedToLobby: true },
      ],
    });

    expect(screen.getByText(/Some Song — Some Artist/)).toBeInTheDocument();
  });

  test('shows "(en attente)" in the lobby for a player who has not confirmed return', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });
    await screen.findByText('Alice');
    socket.emit({
      type: 'game:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [
        { playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 },
        { playerId: 'p2', nickname: 'Bob', foundStage: null, score: 0 },
      ],
    });
    await screen.findByText(/Some Song — Some Artist/);

    await userEvent.click(screen.getByText('Retour au lobby'));
    socket.emit({
      type: 'game:reset',
      players: [
        { playerId: 'p1', nickname: 'Alice', status: 'active', returnedToLobby: true },
        { playerId: 'p2', nickname: 'Bob', status: 'active', returnedToLobby: false },
      ],
    });

    expect(await screen.findByText(/Bob/)).toHaveTextContent('(en attente)');
    expect(screen.getByText(/Alice/)).not.toHaveTextContent('(en attente)');
  });

  test('a straggler stuck on results is pulled into the new round once stage:start arrives', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({
      type: 'game:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 }],
    });
    await screen.findByText(/Some Song — Some Artist/);

    socket.emit({ type: 'stage:start', maxStage: 6, stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });

    expect(await screen.findByText(/Étape 1/)).toBeInTheDocument();
  });

  test('the host sees a kick button next to other players but not next to themselves', async () => {
    localStorage.setItem('hostToken:g1', 'token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });
    await screen.findByText('Alice');

    expect(screen.getByRole('button', { name: 'Retirer Bob' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirer Alice' })).not.toBeInTheDocument();
  });

  test('a non-host player never sees a kick button', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });
    await screen.findByText('Alice');

    expect(screen.queryByRole('button', { name: /Retirer/ })).not.toBeInTheDocument();
  });

  test('clicking the kick button sends player:kick with the host token and target', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [
        { playerId: 'p1', nickname: 'Alice' },
        { playerId: 'p2', nickname: 'Bob' },
      ],
    });
    await screen.findByText('Alice');

    await userEvent.click(screen.getByRole('button', { name: 'Retirer Bob' }));

    expect(socket.sent).toContainEqual(
      JSON.stringify({ type: 'player:kick', hostToken: 'the-host-token', targetPlayerId: 'p2' })
    );
  });

  test('receiving player:kicked calls onLeave', async () => {
    const onLeave = vi.fn();
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={onLeave} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');

    socket.emit({ type: 'player:kicked' });

    expect(onLeave).toHaveBeenCalledOnce();
  });
});
