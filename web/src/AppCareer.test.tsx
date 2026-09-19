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
  totalTurns: 20,
  releaseAt: 10,
  energy: 4,
  maxEnergy: 4,
  stats: { oreille: 0, memoire: 0, culture: 0 },
  suggestionCount: 1,
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
  test('choosing Mode Carrière without a career offers to start one', async () => {
    render(<App />);

    await userEvent.click(screen.getByText('Mode Carrière'));

    expect(await screen.findByRole('button', { name: 'Commencer une carrière' })).toBeInTheDocument();
  });

  test('starting a career shows the hub, and a study opens a round of 3 attempts', async () => {
    vi.mocked(api.startCareer).mockResolvedValue({ career, round: null });
    vi.mocked(api.studyCareer).mockResolvedValue({
      career,
      round: { kind: 'study', stat: 'oreille', state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));
    await userEvent.click(await screen.findByRole('button', { name: 'Commencer une carrière' }));

    expect(await screen.findByText('Tour 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Étudier : Oreille' }));

    expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    expect(api.studyCareer).toHaveBeenCalledWith('oreille');
    expect(screen.queryByText('Tour 1')).not.toBeInTheDocument();
  });

  test('a single opens a round and tells which stat is trained', async () => {
    vi.mocked(api.fetchCareer).mockResolvedValue({ career, round: null });
    vi.mocked(api.singleCareer).mockResolvedValue({
      career,
      round: { kind: 'single', stat: 'culture', state: roundState },
    });
    render(<App />);
    await userEvent.click(screen.getByText('Mode Carrière'));

    await userEvent.click(await screen.findByRole('button', { name: 'Sortir un single' }));

    expect(await screen.findByRole('button', { name: 'Valider' })).toBeInTheDocument();
    expect(api.singleCareer).toHaveBeenCalledOnce();
    expect(screen.getByText(/Single \(Culture\) : deviner le titre/)).toBeInTheDocument();
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
      round: { kind: 'study', stat: 'oreille', state: roundState },
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

    expect(await screen.findByRole('button', { name: 'Commencer une carrière' })).toBeInTheDocument();
    expect(api.abandonCareer).toHaveBeenCalledOnce();
  });

  describe('album tracks', () => {
    const midAlbum: Career = { ...career, turn: 11, releaseDue: true, album: { done: 2, total: 6 } };
    const noTracks = { score: 600, maxScore: 600, grade: 'S' as const, tracks: [] };

    test('shows the position of the track being played', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midAlbum,
        round: { kind: 'release', stat: null, state: roundState },
      });
      render(<App />);

      await userEvent.click(screen.getByText('Mode Carrière'));

      expect(await screen.findByText("Sortie de l'album : titre 3 / 6")).toBeInTheDocument();
    });

    test('after a track, "Titre suivant" starts the next one without going back to the hub', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midAlbum,
        round: { kind: 'release', stat: null, state: wonState },
      });
      vi.mocked(api.releaseCareer).mockResolvedValue({
        career: midAlbum,
        round: { kind: 'release', stat: null, state: roundState },
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
        round: { kind: 'release', stat: null, state: wonState },
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
      release: { score: 600, maxScore: 600, grade: 'S', tracks: [] },
      concertDue: true,
      concert: { done: 4, total: 15 },
    };

    test('shows the position of the track being played', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midConcert,
        round: { kind: 'concert', stat: null, state: roundState },
      });
      render(<App />);

      await userEvent.click(screen.getByText('Mode Carrière'));

      expect(await screen.findByText('Concert : titre 5 / 15')).toBeInTheDocument();
    });

    test('after a track, "Titre suivant" starts the next one of the concert', async () => {
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: midConcert,
        round: { kind: 'concert', stat: null, state: wonState },
      });
      vi.mocked(api.concertCareer).mockResolvedValue({
        career: midConcert,
        round: { kind: 'concert', stat: null, state: roundState },
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
        concertResult: { score: 1500, maxScore: 1500, grade: 'S', tracks: [] },
      };
      vi.mocked(api.fetchCareer).mockResolvedValue({
        career: over,
        round: { kind: 'concert', stat: null, state: wonState },
      });
      render(<App />);
      await userEvent.click(screen.getByText('Mode Carrière'));

      await userEvent.click(await screen.findByRole('button', { name: 'Voir le résultat' }));

      expect(await screen.findByText('Score 1500 / 1500')).toBeInTheDocument();
      expect(api.concertCareer).not.toHaveBeenCalled();
    });
  });
});
