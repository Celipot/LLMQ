import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';
import * as api from './api';
import { resizeImageToDataUrl } from './imageResize';

vi.mock('./imageResize', () => ({ resizeImageToDataUrl: vi.fn() }));

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    fetchState: vi.fn(),
    fetchTitles: vi.fn(),
    fetchGameStatus: vi.fn(),
    fetchGenerations: vi.fn(),
    startRandomMode: vi.fn(),
    submitSkip: vi.fn(),
    resetGame: vi.fn(),
    joinGame: vi.fn(),
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

const playingState = {
  attemptsUsed: 0,
  maxAttempts: 6,
  allowedSeconds: 1,
  status: 'playing' as const,
  guesses: [],
};

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

    await waitFor(() => expect(api.startRandomMode).toHaveBeenCalledWith(['Liella'], {}));
  });

  test('Lancer sends the stored play history while the adaptive draw is enabled', async () => {
    const history = { 7: { plays: 2, wins: 1, stageSum: 3, lastPlayedAt: 1_700_000_000_000 } };
    localStorage.setItem('songHistory', JSON.stringify(history));
    vi.mocked(api.startRandomMode).mockResolvedValue(playingState);
    render(<App />);

    await userEvent.click(await screen.findByText('Mode Aléatoire'));
    await userEvent.click(await screen.findByRole('button', { name: 'Lancer' }));

    await waitFor(() => expect(api.startRandomMode).toHaveBeenCalledWith(['Aqours', 'Liella'], history));
  });

  test('Lancer sends no history once the adaptive draw is unchecked', async () => {
    localStorage.setItem('songHistory', JSON.stringify({ 7: { plays: 1, wins: 1, stageSum: 1, lastPlayedAt: 1 } }));
    vi.mocked(api.startRandomMode).mockResolvedValue(playingState);
    render(<App />);

    await userEvent.click(await screen.findByText('Mode Aléatoire'));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Tirage adaptatif/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    await waitFor(() => expect(api.startRandomMode).toHaveBeenCalledWith(['Aqours', 'Liella'], undefined));
  });

  test('"Effacer mon historique" empties the stored history', async () => {
    localStorage.setItem('songHistory', JSON.stringify({ 7: { plays: 1, wins: 1, stageSum: 1, lastPlayedAt: 1 } }));
    render(<App />);

    await userEvent.click(await screen.findByText('Mode Aléatoire'));
    await userEvent.click(await screen.findByRole('button', { name: 'Effacer mon historique' }));

    expect(JSON.parse(localStorage.getItem('songHistory') ?? '{}')).toEqual({});
  });
});

describe('App — solo answer screen', () => {
  const lostState = {
    attemptsUsed: 6,
    maxAttempts: 6,
    allowedSeconds: 30,
    status: 'lost' as const,
    guesses: [],
    correctSongId: 5,
    correctTitle: 'Snow halation',
    correctArtist: "µ's",
    correctCoverUrl: '/covers/2_snowhalation.png',
  };

  async function finishARandomRound() {
    vi.mocked(api.startRandomMode).mockResolvedValue(playingState);
    vi.mocked(api.submitSkip).mockResolvedValue({ state: lostState });
    render(<App />);
    await userEvent.click(await screen.findByText('Mode Aléatoire'));
    await userEvent.click(await screen.findByRole('button', { name: 'Lancer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Passer' }));
  }

  test('once the round is over, the answer replaces the whole quiz', async () => {
    await finishARandomRound();

    expect(await screen.findByRole('heading', { name: 'Perdu' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Snow halation' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument();
  });

  test('only "Musique suivante" and "Accueil" are offered, with a single Accueil button', async () => {
    await finishARandomRound();

    await screen.findByRole('heading', { name: 'Perdu' });
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Musique suivante',
      'Accueil',
    ]);
  });

  test('"Musique suivante" draws another song and brings the quiz back', async () => {
    vi.mocked(api.resetGame).mockResolvedValue(playingState);
    await finishARandomRound();

    await userEvent.click(await screen.findByRole('button', { name: 'Musique suivante' }));

    expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    expect(api.resetGame).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Perdu' })).not.toBeInTheDocument();
  });

  test('"Accueil" goes back to the mode choice', async () => {
    await finishARandomRound();

    await userEvent.click(await screen.findByRole('button', { name: 'Accueil' }));

    expect(await screen.findByText('Choisis un mode pour commencer')).toBeInTheDocument();
  });
});

describe("App — profile", () => {
  test('the Profil button sits in the header of the home page, next to the title', async () => {
    render(<App />);

    const button = await screen.findByRole('button', { name: 'Profil' });

    expect(button.closest('.app-header')).toContainElement(screen.getByRole('heading', { name: 'LLMQ' }));
  });

  test('the Profil button is not offered on the other screens', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Profil' }));

    expect(screen.queryByRole('button', { name: 'Profil' })).not.toBeInTheDocument();
  });

  test("the Profil button opens the profile screen", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Profil" }));

    expect(await screen.findByLabelText("Nom d'utilisateur")).toBeInTheDocument();
  });

  test("saving a username stores it in the profile", async () => {
    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Profil" }));
    await userEvent.type(await screen.findByLabelText("Nom d'utilisateur"), "Alice");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(JSON.parse(localStorage.getItem("profile") ?? "{}").username).toBe("Alice");
  });

  test("opening a game link joins straight away with the profile username", async () => {
    localStorage.setItem("profile", JSON.stringify({ username: "Alice" }));
    window.history.pushState({}, "", "/game/g1");
    vi.mocked(api.fetchGameStatus).mockResolvedValue({ gameId: "g1", status: "lobby" });
    vi.mocked(api.joinGame).mockResolvedValue({ playerId: "p1", players: [] });

    render(<App />);

    expect(await screen.findByText("En attente du lancement de la partie...")).toBeInTheDocument();
    expect(api.joinGame).toHaveBeenCalledWith("g1", "Alice", undefined, undefined);
  });

  test('choosing a picture stores it in the profile', async () => {
    vi.mocked(resizeImageToDataUrl).mockResolvedValue('data:image/jpeg;base64,AAAA');
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Profil' }));
    await userEvent.upload(await screen.findByLabelText('Photo de profil'), new File(['x'], 'me.png', { type: 'image/png' }));

    await waitFor(() => expect(JSON.parse(localStorage.getItem('profile') ?? '{}').avatar).toBe('data:image/jpeg;base64,AAAA'));
  });

  test('joining a game link sends the profile picture too', async () => {
    localStorage.setItem('profile', JSON.stringify({ username: 'Alice', avatar: 'data:image/jpeg;base64,AAAA' }));
    window.history.pushState({}, '', '/game/g1');
    vi.mocked(api.fetchGameStatus).mockResolvedValue({ gameId: 'g1', status: 'lobby' });
    vi.mocked(api.joinGame).mockResolvedValue({ playerId: 'p1', players: [] });

    render(<App />);

    await screen.findByText('En attente du lancement de la partie...');
    expect(api.joinGame).toHaveBeenCalledWith('g1', 'Alice', undefined, 'data:image/jpeg;base64,AAAA');
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
