import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';
import * as api from './api';
import { ApiError } from './api';
import type { Career, GameState } from './types';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return {
    ...actual,
    fetchState: vi.fn(),
    fetchTitles: vi.fn(),
    fetchGenerations: vi.fn(),
    fetchCareer: vi.fn(),
    startCareer: vi.fn(),
    studyCareer: vi.fn(),
    singleCareer: vi.fn(),
    releaseCareer: vi.fn(),
    concertCareer: vi.fn(),
    abandonCareer: vi.fn(),
  };
});

const career: Career = {
  turn: 1,
  concertAt: 20,
  finalTurn: 50,
  statMax: { oreille: 300, memoire: 300, culture: 200 },
  modifiers: [],
  phase3: false,
  sorties: [],
  liveCosts: { album: 3, concert: 4 },
  live: null,
  finaleGoals: {
    concerts: { done: 0, good: 0, required: 2, requiredGood: 2 },
    albums: { done: 0, good: 0, required: 3, requiredGood: 2 },
    met: false,
  },
  finaleDue: false,
  finaleResult: null,
  events: [],
  newEvents: [],
  pendingChoice: null,
  releaseAt: 10,
  energy: 4,
  maxEnergy: 4,
  stats: { oreille: 0, memoire: 0, culture: 0 },
  suggestionCount: 1,
  unit: 'azuna',
  difficulty: 'hard',
  baseTiers: [1, 2, 3],
  baseSuggestions: 1,
  costs: { study: 1, single: 2 },
  statStep: 100,
  notebook: [],
  releaseDue: false,
  album: { done: 0, total: 6 },
  release: null,
  concertDue: false,
  concert: { done: 0, total: 15 },
  concertResult: null,
  fans: { current: 0, required: 300 },
  failure: null,
  albumGoalGrade: 'B',
  finalScore: null,
};

const roundState: GameState = { attemptsUsed: 0, maxAttempts: 3, allowedSeconds: 1, status: 'playing', guesses: [] };
const wonState: GameState = { ...roundState, attemptsUsed: 1, status: 'won', correctTitle: 'Song', correctArtist: 'Artist' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchState).mockResolvedValue({ ...roundState, maxAttempts: 6 });
  vi.mocked(api.fetchTitles).mockResolvedValue([]);
  vi.mocked(api.fetchGenerations).mockResolvedValue([]);
  vi.mocked(api.fetchCareer).mockRejectedValue(new ApiError('NO_CAREER'));
});

describe('App — Mode Carrière', () => {
  test('choosing Mode Carrière without a career offers the two difficulties', async () => {
    render(<App />);

    await userEvent.click(screen.getByText('Mode Carrière'));

    expect(await screen.findByRole('button', { name: 'Normal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Difficile' })).toBeInTheDocument();
  });

  test('starting a career shows the hub, and a study opens a round of 3 attempts', async () => {
    vi.mocked(api.startCareer).mockResolvedValue({ career, round: null });
    vi.mocked(api.studyCareer).mockResolvedValue({
      career,
      round: { kind: 'study', stat: 'oreille', inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));
    await userEvent.click(await screen.findByRole('button', { name: 'Normal' }));

    expect(await screen.findByText('Tour 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Chanter' }));

    expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    expect(api.startCareer).toHaveBeenCalledWith({ unit: 'azuna', difficulty: 'normal' });
    expect(api.studyCareer).toHaveBeenCalledWith('oreille');
    expect(screen.queryByText(/deviner le titre/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Tour 1')).not.toBeInTheDocument();
  });

  test('a single opens a round and tells which stat is trained', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({ career, round: null });
    vi.mocked(api.singleCareer).mockResolvedValue({
      career,
      round: { kind: 'single', stat: 'culture', inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    await userEvent.click(await screen.findByRole('button', { name: 'Se faire connaître' }));

    expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    expect(api.singleCareer).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Se faire connaître' })).toBeInTheDocument();
    expect(screen.getByText('Stat travaillée : Endurance')).toBeInTheDocument();
    expect(screen.queryByText(/deviner le titre/i)).not.toBeInTheDocument();
  });

  test.each([
    ['study', 'Étude'],
    ['single', 'Se faire connaître'],
    ['release', 'Album'],
    ['concert', 'Concert'],
    ['finale', 'SIF'],
  ] as const)('the guessing screen of a %s round is titled %s', async (kind, title) => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career: { ...career, live: { kind: 'album', done: 0, total: 6 } },
      round: { kind, stat: kind === 'study' || kind === 'single' ? 'oreille' : null, inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  test('the guessing screen shows the career illustration', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career,
      round: { kind: 'study', stat: 'oreille', inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const image = await screen.findByRole('img', { name: 'Illustration de la carrière' });
    expect(image).toHaveAttribute('src', '/units/azuna/career.png');
  });

  test('an album round shows the album cover instead of the career illustration', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career,
      round: { kind: 'release', stat: null, inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const image = await screen.findByRole('img', { name: "Cover de l'album" });
    expect(image).toHaveAttribute('src', '/units/azuna/album.png');
    expect(screen.queryByRole('img', { name: 'Illustration de la carrière' })).not.toBeInTheDocument();
  });

  test('a concert round shows the concert illustration instead of the career one', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career,
      round: { kind: 'concert', stat: null, inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const image = await screen.findByRole('img', { name: 'Illustration du concert' });
    expect(image).toHaveAttribute('src', '/units/azuna/concert.png');
    expect(screen.queryByRole('img', { name: 'Illustration de la carrière' })).not.toBeInTheDocument();
  });

  test('a round to get known shows its own illustration instead of the career one', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career,
      round: { kind: 'single', stat: 'culture', inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const image = await screen.findByRole('img', { name: 'Illustration de Se faire connaître' });
    expect(image).toHaveAttribute('src', '/units/azuna/single.png');
    expect(screen.queryByRole('img', { name: 'Illustration de la carrière' })).not.toBeInTheDocument();
  });

  test('a finale round shows the SIF illustration instead of the career one', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career,
      round: { kind: 'finale', stat: null, inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const image = await screen.findByRole('img', { name: 'Illustration du SIF' });
    expect(image).toHaveAttribute('src', '/sif-illustration.png');
    expect(screen.queryByRole('img', { name: 'Illustration de la carrière' })).not.toBeInTheDocument();
  });

  test('the hint on the title sits on the guessing screen, above the notebook', async () => {
    const notebook = [{ id: 1, title: 'Awakening Promise', coverUrl: '/covers/a.png' }];
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career: { ...career, notebook },
      round: {
        kind: 'study',
        stat: 'oreille',
        inNotebook: false,
        hint: { group: 'Solo', singer: 'Ayumu Uehara' },
        state: roundState,
      },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const notebookColumn = await screen.findByRole('complementary', { name: 'Carnet' });
    expect(notebookColumn).toHaveTextContent('Solo : Ayumu Uehara');
  });

  test('a unit without its own images shows the placeholder on its rounds', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career: { ...career, unit: 'qu4rtz' },
      round: { kind: 'concert', stat: null, inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const concert = await screen.findByRole('img', { name: 'Illustration du concert' });
    expect(concert).toHaveAttribute('src', '/unit-placeholder.svg');
  });

  test('the finale image is the shared one for any unit', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career: { ...career, unit: 'r3birth' },
      round: { kind: 'finale', stat: null, inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const image = await screen.findByRole('img', { name: 'Illustration du SIF' });
    expect(image).toHaveAttribute('src', '/sif-illustration.png');
  });

  test('the notebook stays on the left of the guessing screen', async () => {
    const notebook = [{ id: 1, title: 'Awakening Promise', coverUrl: '/covers/a.png' }];
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career: { ...career, notebook },
      round: { kind: 'study', stat: 'oreille', inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const notebookColumn = await screen.findByRole('complementary', { name: 'Carnet' });
    expect(notebookColumn).toHaveTextContent('Awakening Promise');
    const search = screen.getByRole('textbox', { name: 'Rechercher un titre' });
    expect(notebookColumn.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('the guessing screen tells when the title is in the notebook', async () => {
    const notebook = [{ id: 1, title: 'Awakening Promise', coverUrl: '/covers/a.png' }];
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career: { ...career, notebook },
      round: { kind: 'release', stat: null, inNotebook: true, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    expect(await screen.findByText('Ce titre est dans ton carnet')).toBeInTheDocument();
  });

  test('once a round is over, Continuer sits under Valider and the answer is smaller, on the right', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career,
      round: { kind: 'study', stat: 'oreille', inNotebook: false, state: wonState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const validate = await screen.findByRole('button', { name: 'Valider' });
    const next = screen.getByRole('button', { name: 'Continuer' });
    expect(validate.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/La chanson était/).closest('.career-round-answer')).not.toBeNull();
    expect(screen.getByText(/La chanson était/).closest('.career-round-controls')).toBeNull();
  });

  test('the restart button sits in the header, to the left of Accueil', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({ career, round: null });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    const restart = await screen.findByRole('button', { name: 'Recommencer la carrière' });
    const home = screen.getByRole('button', { name: 'Accueil' });

    expect(restart.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(restart.closest('.app-header')).not.toBeNull();
  });

  test('the restart button is hidden while a round is in progress', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({
      career,
      round: { kind: 'study', stat: 'oreille', inNotebook: false, state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recommencer la carrière' })).not.toBeInTheDocument();
  });

  test('the restart button is hidden once the career is over', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({ career: { ...career, failure: 'FANS' }, round: null });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    expect(await screen.findByRole('button', { name: 'Nouvelle carrière' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recommencer la carrière' })).not.toBeInTheDocument();
  });

  test('restarting the career goes back to the first screen of the mode', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({ career, round: null });
    vi.mocked(api.abandonCareer).mockResolvedValue(undefined);
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    await userEvent.click(await screen.findByRole('button', { name: 'Recommencer la carrière' }));

    expect(await screen.findByRole('button', { name: 'Normal' })).toBeInTheDocument();
    expect(api.abandonCareer).toHaveBeenCalledOnce();
  });

  describe('album tracks', () => {
    const midAlbum: Career = { ...career, turn: 11, releaseDue: true, album: { done: 2, total: 6 } };
    const noTracks = { score: 600, maxScore: 600, grade: 'S' as const, turn: 10, tracks: [] };

    test('shows the position of the track being played', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midAlbum,
        round: { kind: 'release', stat: null, inNotebook: false, state: roundState },
      });
      render(<App />);

      await userEvent.click(screen.getByText('Mode Carrière'));

      expect(await screen.findByText('Titre 3 / 6')).toBeInTheDocument();
    });

    test('after a track, "Titre suivant" starts the next one without going back to the hub', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midAlbum,
        round: { kind: 'release', stat: null, inNotebook: false, state: wonState },
      });
      vi.mocked(api.releaseCareer).mockResolvedValue({
        career: midAlbum,
        round: { kind: 'release', stat: null, inNotebook: false, state: roundState },
      });
      render(<App />);
      await userEvent.click(screen.getByText('Mode Carrière'));

      await userEvent.click(await screen.findByRole('button', { name: 'Titre suivant' }));

      expect(api.releaseCareer).toHaveBeenCalledOnce();
      expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    });

    test('after the last track, the result button goes back to the hub with the grade', async () => {
      const released: Career = {
        ...midAlbum,
        album: { done: 6, total: 6 },
        release: noTracks,
      };
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: released,
        round: { kind: 'release', stat: null, inNotebook: false, state: wonState },
      });
      render(<App />);
      await userEvent.click(screen.getByText('Mode Carrière'));

      await userEvent.click(await screen.findByRole('button', { name: 'Voir le résultat' }));

      expect(await screen.findByText('Grade S')).toBeInTheDocument();
      expect(api.releaseCareer).not.toHaveBeenCalled();
    });
  });

  describe('concert tracks', () => {
    const midConcert: Career = {
      ...career,
      turn: 21,
      release: { score: 600, maxScore: 600, grade: 'S', turn: 10, tracks: [] },
      concertDue: true,
      concert: { done: 4, total: 15 },
    };

    test('shows the position of the track being played', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midConcert,
        round: { kind: 'concert', stat: null, inNotebook: false, state: roundState },
      });
      render(<App />);

      await userEvent.click(screen.getByText('Mode Carrière'));

      expect(await screen.findByText('Titre 5 / 15')).toBeInTheDocument();
    });

    test('after a track, "Titre suivant" starts the next one of the concert', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midConcert,
        round: { kind: 'concert', stat: null, inNotebook: false, state: wonState },
      });
      vi.mocked(api.concertCareer).mockResolvedValue({
        career: midConcert,
        round: { kind: 'concert', stat: null, inNotebook: false, state: roundState },
      });
      render(<App />);
      await userEvent.click(screen.getByText('Mode Carrière'));

      await userEvent.click(await screen.findByRole('button', { name: 'Titre suivant' }));

      expect(api.concertCareer).toHaveBeenCalledOnce();
      expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    });

    test('after the last track, the result button shows the concert grade', async () => {
      const over: Career = {
        ...midConcert,
        concert: { done: 15, total: 15 },
        concertResult: { score: 1500, maxScore: 1500, grade: 'S', turn: 10, tracks: [] },
      };
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: over,
        round: { kind: 'concert', stat: null, inNotebook: false, state: wonState },
      });
      render(<App />);
      await userEvent.click(screen.getByText('Mode Carrière'));

      await userEvent.click(await screen.findByRole('button', { name: 'Voir le résultat' }));

      expect(await screen.findByText('Score 1500 / 1500')).toBeInTheDocument();
      expect(api.concertCareer).not.toHaveBeenCalled();
    });
  });
});
