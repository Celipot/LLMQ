import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import CareerHub from './CareerHub';
import type { Career } from '../types';

const career: Career = {
  turn: 3,
  totalTurns: 10,
  energy: 2,
  maxEnergy: 3,
  stats: { oreille: 80, memoire: 0, culture: 130 },
  suggestionCount: 1,
  notebook: [],
  releaseDue: false,
  album: { done: 0, total: 6 },
  release: null,
};

function renderHub(overrides: Partial<Career> | null = {}, props: Partial<Parameters<typeof CareerHub>[0]> = {}) {
  const handlers = { onBegin: vi.fn(), onRest: vi.fn(), onStudy: vi.fn(), onRelease: vi.fn() };
  render(
    <CareerHub career={overrides === null ? null : { ...career, ...overrides }} error={null} {...handlers} {...props} />,
  );
  return handlers;
}

describe('CareerHub', () => {
  test('without a career, offers to start one', async () => {
    const { onBegin } = renderHub(null);

    await userEvent.click(screen.getByRole('button', { name: 'Commencer une carrière' }));

    expect(onBegin).toHaveBeenCalledOnce();
  });

  test('shows the turn and the energy', () => {
    renderHub();

    expect(screen.getByText('Tour 3 / 10')).toBeInTheDocument();
    expect(screen.getByText('Énergie 2 / 3')).toBeInTheDocument();
  });

  test('shows each stat with its value', () => {
    renderHub();

    expect(screen.getByText('Oreille')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('130')).toBeInTheDocument();
  });

  test('each study button trains its own stat', async () => {
    const { onStudy } = renderHub();

    await userEvent.click(screen.getByRole('button', { name: 'Étudier : Mémoire' }));

    expect(onStudy).toHaveBeenCalledWith('memoire');
  });

  test('the rest button calls onRest', async () => {
    const { onRest } = renderHub();

    await userEvent.click(screen.getByRole('button', { name: 'Se reposer' }));

    expect(onRest).toHaveBeenCalledOnce();
  });

  test('without energy studying is disabled but resting is not', () => {
    renderHub({ energy: 0 });

    expect(screen.getByRole('button', { name: 'Étudier : Oreille' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Se reposer' })).toBeEnabled();
  });

  test('once the release is due only the release can be played', async () => {
    const { onRelease } = renderHub({ releaseDue: true, turn: 11 });

    expect(screen.queryByRole('button', { name: 'Se reposer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Étudier : Oreille' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Lancer la sortie de l'album" }));

    expect(onRelease).toHaveBeenCalledOnce();
  });

  test('lists the titles of the notebook', () => {
    renderHub({ notebook: [{ id: 1, title: 'Awakening Promise', coverUrl: '/covers/a.png' }] });

    expect(screen.getByText('Awakening Promise')).toBeInTheDocument();
  });

  test('an album already started offers to go on, with its progress', async () => {
    const { onRelease } = renderHub({ releaseDue: true, turn: 11, album: { done: 2, total: 6 } });

    await userEvent.click(screen.getByRole('button', { name: "Poursuivre l'album (2 / 6)" }));

    expect(onRelease).toHaveBeenCalledOnce();
  });

  describe('a released album', () => {
    const release: Career['release'] = {
      score: 420,
      maxScore: 600,
      grade: 'A',
      tracks: [
        { song: { id: 1, title: 'Dream with You', coverUrl: '/covers/d.png' }, rank: 'S', points: 100 },
        { song: { id: 2, title: 'Kaika Sengen', coverUrl: '/covers/k.png' }, rank: 'FAIL', points: 0 },
      ],
    };

    test('shows the grade, the score and every track with its points', () => {
      renderHub({ releaseDue: true, turn: 11, album: { done: 6, total: 6 }, release });

      expect(screen.getByText('Grade A')).toBeInTheDocument();
      expect(screen.getByText('Score 420 / 600')).toBeInTheDocument();
      expect(screen.getByText('Dream with You')).toBeInTheDocument();
      expect(screen.getByText('Kaika Sengen')).toBeInTheDocument();
      expect(screen.getByText('100 pts')).toBeInTheDocument();
      expect(screen.getByText('0 pt')).toBeInTheDocument();
    });

    test('offers a new career and no more release', async () => {
      const { onBegin } = renderHub({ releaseDue: true, turn: 11, album: { done: 6, total: 6 }, release });

      expect(screen.queryByRole('button', { name: /album/ })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Nouvelle carrière' }));

      expect(onBegin).toHaveBeenCalledOnce();
    });
  });

  test('shows the error message', () => {
    renderHub({}, { error: 'Une erreur est survenue.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur est survenue.');
  });
});
