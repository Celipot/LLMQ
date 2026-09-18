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
    updateStageDuration: vi.fn(),
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
  vi.mocked(api.updateStageDuration).mockResolvedValue({ stageOneSeconds: 1 });
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

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '25' } });

    await waitFor(() => expect(api.updateSongCount).toHaveBeenCalledWith('g1', 'the-host-token', 25));
  });

  test('clamps the song count to the 1-100 range for the host', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }], songCount: 1 });
    await screen.findByText('Alice');

    const input = screen.getByRole('spinbutton');
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

  test('shows the host-chosen stage duration as read-only text for a non-host player', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      stageOneSeconds: 3,
    });

    expect(await screen.findByText("Durée de l'étape 1 : 3s")).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  test('the host can drag the stage duration slider, which calls updateStageDuration', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      stageOneSeconds: 1,
    });
    await screen.findByText('Alice');

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '4' } });

    await waitFor(() => expect(api.updateStageDuration).toHaveBeenCalledWith('g1', 'the-host-token', 4));
  });

  test('clamps the stage duration to the 1-5 range for the host', async () => {
    localStorage.setItem('hostToken:g1', 'the-host-token');
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      stageOneSeconds: 1,
    });
    await screen.findByText('Alice');

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '9' } });

    await waitFor(() => expect(api.updateStageDuration).toHaveBeenCalledWith('g1', 'the-host-token', 5));
  });

  test('updates the displayed stage duration for everyone on lobby:stageDuration', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({
      type: 'lobby:state',
      players: [{ playerId: 'p1', nickname: 'Alice' }],
      stageOneSeconds: 1,
    });
    await screen.findByText("Durée de l'étape 1 : 1s");

    socket.emit({ type: 'lobby:stageDuration', stageOneSeconds: 4 });

    expect(await screen.findByText("Durée de l'étape 1 : 4s")).toBeInTheDocument();
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
      type: 'stage:start',
      stage: 1,
      durationSeconds: 1,
      serverTimestamp: Date.now(),
      answerWindowMs: 30000,
      nextDurationSeconds: 2,
    });

    expect(await screen.findByText(/Étape 1/)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 30s');
    expect(screen.getByText(/Étape 1/).closest('p')).toHaveTextContent('Étape 11s');
    expect(screen.getByText('(2s — étape suivante)')).toBeInTheDocument();
  });

  test('sends answer:submit over the socket and shows the result once received', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
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
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
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
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    expect(await screen.findByText('Bob — cherche encore')).toBeInTheDocument();

    socket.emit({ type: 'player:status', playerId: 'p2', status: 'found', stage: 1 });

    expect(await screen.findByText('Bob — a trouvé')).toBeInTheDocument();
  });

  test('reflects its own found status in the shared player list once answer:result arrives', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    socket.emit({ type: 'answer:result', correct: true });

    expect(await screen.findByText('Alice — a trouvé')).toBeInTheDocument();
  });

  test('does not reset a found player back to active when the stage advances', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);
    socket.emit({ type: 'answer:result', correct: true });
    await screen.findByText('Alice — a trouvé');

    socket.emit({ type: 'stage:start', stage: 2, durationSeconds: 2, serverTimestamp: Date.now(), answerWindowMs: 30000 });

    await screen.findByText(/Étape 2/);
    expect(screen.getByText('Alice — a trouvé')).toBeInTheDocument();
  });

  test('shows the song reveal banner on song:ended and starts the next song on the following stage:start', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 1, songCount: 2 });
    await screen.findByText(/Musique 1\/2/);

    socket.emit({
      type: 'song:ended',
      song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
      players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6, totalScore: 6 }],
      songIndex: 1,
      songCount: 2,
    });

    expect(await screen.findByText(/Some Song — Some Artist/)).toBeInTheDocument();
    expect(screen.getByText(/Alice — cherche encore/)).toHaveTextContent('6 pts');

    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000, songIndex: 2, songCount: 2 });

    expect(await screen.findByText(/Musique 2\/2/)).toBeInTheDocument();
    expect(screen.queryByText(/Some Song — Some Artist/)).not.toBeInTheDocument();
    // The running score survives into the next song, unlike the transient
    // reveal banner above.
    expect(screen.getByText(/Alice — cherche encore/)).toHaveTextContent('6 pts');
  });

  test('renders GameResult once game:ended is received', async () => {
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={vi.fn()} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice', status: 'active' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
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
      durationSeconds: 2,
      remainingMs: 10000,
      players: [{ playerId: 'p1', nickname: 'Alice', status: 'found' }],
    });

    vi.useRealTimers();
    expect(await screen.findByText(/Étape 2/)).toBeInTheDocument();
    expect(await screen.findByText('Alice — a trouvé')).toBeInTheDocument();
    // The countdown is seeded from the server's authoritative remainingMs on
    // resync, not restarted at a full answer window.
    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 10s');
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
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    socket.emit({ type: 'player:connection', playerId: 'p2', connected: false });

    expect(await screen.findByText(/Bob — cherche encore/)).toHaveTextContent('(déconnecté)');
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

  test('clicking "Quitter la partie" during a stage sends player:leave and calls onLeave', async () => {
    const onLeave = vi.fn();
    render(<Lobby gameId="g1" playerId="p1" onSessionInvalid={vi.fn()} onLeave={onLeave} />);
    const socket = MockWebSocket.instances[0];
    socket.emit({ type: 'lobby:state', players: [{ playerId: 'p1', nickname: 'Alice' }] });
    await screen.findByText('Alice');
    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });
    await screen.findByText(/Étape 1/);

    await userEvent.click(screen.getByText('Quitter la partie'));

    expect(socket.sent).toContainEqual(JSON.stringify({ type: 'player:leave' }));
    expect(onLeave).toHaveBeenCalledOnce();
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

    socket.emit({ type: 'stage:start', stage: 1, durationSeconds: 1, serverTimestamp: Date.now(), answerWindowMs: 30000 });

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
