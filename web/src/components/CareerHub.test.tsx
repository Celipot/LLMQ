import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import CareerHub from './CareerHub';
import type { Career, CareerResult } from '../types';

const career: Career = {
  turn: 3,
  totalTurns: 20,
  releaseAt: 10,
  energy: 2,
  maxEnergy: 4,
  stats: { oreille: 80, memoire: 0, culture: 130 },
  suggestionCount: 1,
  notebook: [],
  releaseDue: false,
  album: { done: 0, total: 6 },
  release: null,
  concertDue: false,
  concert: { done: 0, total: 15 },
  concertResult: null,
  fans: { current: 120, required: 300 },
  failure: null,
  albumGoalGrade: 'B',
};

const albumResult: CareerResult = {
  score: 420,
  maxScore: 600,
  grade: 'A',
  tracks: [
    { song: { id: 1, title: 'Dream with You', coverUrl: '/covers/d.png' }, rank: 'S', points: 100 },
    { song: { id: 2, title: 'Kaika Sengen', coverUrl: '/covers/k.png' }, rank: 'FAIL', points: 0 },
  ],
};

const concertResult: CareerResult = {
  score: 1350,
  maxScore: 1500,
  grade: 'S',
  tracks: [{ song: { id: 3, title: 'Yume no Tobira', coverUrl: '/covers/y.png' }, rank: 'S', points: 100 }],
};

function renderHub(overrides: Partial<Career> | null = {}, props: Partial<Parameters<typeof CareerHub>[0]> = {}) {
  const handlers = {
    onBegin: vi.fn(),
    onRest: vi.fn(),
    onStudy: vi.fn(),
    onSingle: vi.fn(),
    onRelease: vi.fn(),
    onConcert: vi.fn(),
    onRestart: vi.fn(),
  };
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

    expect(screen.getByText('Tour 3 / 20')).toBeInTheDocument();
    expect(screen.getByText('Énergie 2 / 4')).toBeInTheDocument();
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

  test('the single button releases a single without choosing a stat', async () => {
    const { onSingle } = renderHub();

    await userEvent.click(screen.getByRole('button', { name: 'Sortir un single' }));

    expect(onSingle).toHaveBeenCalledOnce();
  });

  test('with only 1 energy a single is disabled but a study is not', () => {
    renderHub({ energy: 1 });

    expect(screen.getByRole('button', { name: 'Sortir un single' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Étudier : Oreille' })).toBeEnabled();
  });

  test('the restart button abandons the career', async () => {
    const { onRestart } = renderHub();

    await userEvent.click(screen.getByRole('button', { name: 'Recommencer la carrière' }));

    expect(onRestart).toHaveBeenCalledOnce();
  });

  test('the restart button is also there while the release or the concert is due', () => {
    renderHub({ releaseDue: true, turn: 11 });
    expect(screen.getByRole('button', { name: 'Recommencer la carrière' })).toBeInTheDocument();
  });

  test('the rest button calls onRest', async () => {
    const { onRest } = renderHub();

    await userEvent.click(screen.getByRole('button', { name: 'Se reposer' }));

    expect(onRest).toHaveBeenCalledOnce();
  });

  test('without energy studying is disabled but resting is not', () => {
    renderHub({ energy: 0 });

    expect(screen.getByRole('button', { name: 'Étudier : Oreille' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sortir un single' })).toBeDisabled();
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
    const released = { turn: 11, album: { done: 6, total: 6 }, release: albumResult };

    test('shows only the grade until the detail is opened', async () => {
      renderHub(released);

      expect(screen.getByText('Grade A')).toBeVisible();
      expect(screen.getByText('Score 420 / 600')).not.toBeVisible();
      expect(screen.getByText('Dream with You')).not.toBeVisible();

      await userEvent.click(screen.getByText('Album'));

      expect(screen.getByText('Score 420 / 600')).toBeVisible();
      expect(screen.getByText('Dream with You')).toBeVisible();
      expect(screen.getByText('Kaika Sengen')).toBeVisible();
      expect(screen.getByText('100 pts')).toBeVisible();
      expect(screen.getByText('0 pt')).toBeVisible();
    });

    test('the career goes on: study, single and rest are available and no more album', () => {
      renderHub(released);

      expect(screen.getByRole('button', { name: 'Étudier : Oreille' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sortir un single' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Se reposer' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /album/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Nouvelle carrière' })).not.toBeInTheDocument();
    });
  });

  describe('the concert', () => {
    const due = { turn: 21, release: albumResult, concertDue: true };

    test('once due only the concert can be played', async () => {
      const { onConcert } = renderHub(due);

      expect(screen.queryByRole('button', { name: 'Se reposer' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sortir un single' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Lancer le concert' }));

      expect(onConcert).toHaveBeenCalledOnce();
    });

    test('a concert already started offers to go on, with its progress', async () => {
      const { onConcert } = renderHub({ ...due, concert: { done: 4, total: 15 } });

      await userEvent.click(screen.getByRole('button', { name: 'Poursuivre le concert (4 / 15)' }));

      expect(onConcert).toHaveBeenCalledOnce();
    });

    test('once over shows its grade and score and offers a new career', async () => {
      const { onBegin } = renderHub({
        ...due,
        concert: { done: 15, total: 15 },
        concertResult,
      });

      expect(screen.getByText('Grade S')).toBeVisible();
      expect(screen.getByText('Score 1350 / 1500')).not.toBeVisible();
      await userEvent.click(screen.getByText('Concert'));
      expect(screen.getByText('Score 1350 / 1500')).toBeVisible();
      expect(screen.queryByRole('button', { name: /concert/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Recommencer la carrière' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Nouvelle carrière' }));

      expect(onBegin).toHaveBeenCalledOnce();
    });
  });

  test('shows the fans of the career', () => {
    renderHub();

    expect(screen.getByText('FSI 120 / 300')).toBeInTheDocument();
  });

  describe('the current objective', () => {
    const objective = () => screen.getByRole('region', { name: 'Objectif en cours' });

    test('before the album: release it with at least the grade B', () => {
      renderHub();

      expect(objective()).toHaveTextContent("Sortir l'album avec un grade B ou mieux");
    });

    test('once the album is released: win the fans needed for the concert', () => {
      renderHub({ turn: 12, release: albumResult });

      expect(objective()).toHaveTextContent('Atteindre 300 FSI pour participer au concert (120 / 300)');
    });

    test('once the concert is due: give it', () => {
      renderHub({ turn: 21, release: albumResult, concertDue: true });

      expect(objective()).toHaveTextContent('Donner le concert');
    });

    test('once the concert is over the career is complete', () => {
      renderHub({ turn: 21, release: albumResult, concertDue: true, concertResult });

      expect(objective()).toHaveTextContent('Carrière terminée');
    });

    test('a failed album is reported as a missed objective', () => {
      renderHub({ turn: 11, release: albumResult, failure: 'ALBUM_GRADE' });

      expect(objective()).toHaveTextContent("Objectif raté : l'album n'a pas atteint le grade B");
    });

    test('missing fans is reported as a missed objective', () => {
      renderHub({ turn: 21, release: albumResult, failure: 'FANS' });

      expect(objective()).toHaveTextContent('Objectif raté : pas assez de FSI pour participer au concert (120 / 300)');
    });
  });

  describe('a failed career', () => {
    const failed = { turn: 21, release: albumResult, failure: 'FANS' as const };

    test('offers only a new career', async () => {
      const { onBegin } = renderHub(failed);

      expect(screen.queryByRole('button', { name: 'Se reposer' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Recommencer la carrière' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Nouvelle carrière' }));

      expect(onBegin).toHaveBeenCalledOnce();
    });
  });

  test('a placeholder image sits between the objective and the actions', () => {
    renderHub();

    const objective = screen.getByRole('region', { name: 'Objectif en cours' });
    const image = screen.getByRole('img', { name: 'Illustration de la carrière' });
    const actions = screen.getByRole('group', { name: 'Actions' });
    expect(objective.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(image.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe('layout', () => {
    const finished = { turn: 21, release: albumResult, concertDue: true, concertResult };

    test('the stats are in the left column and the actions in the middle', () => {
      renderHub();

      const stats = screen.getByRole('complementary', { name: 'Statistiques' });
      expect(within(stats).getByText('Oreille')).toBeInTheDocument();
      expect(within(stats).queryByRole('button', { name: 'Se reposer' })).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Actions' })).toContainElement(
        screen.getByRole('button', { name: 'Se reposer' }),
      );
    });

    test('the album and concert recaps are in the right column', () => {
      renderHub(finished);

      const recaps = screen.getByRole('complementary', { name: 'Récapitulatifs' });
      expect(within(recaps).getByText('Grade A')).toBeInTheDocument();
      expect(within(recaps).getByText('Grade S')).toBeInTheDocument();
      expect(within(recaps).queryByRole('button', { name: 'Nouvelle carrière' })).not.toBeInTheDocument();
    });

    test('once the concert is over the new career button stays in the middle', () => {
      renderHub(finished);

      expect(screen.getByRole('group', { name: 'Actions' })).toContainElement(
        screen.getByRole('button', { name: 'Nouvelle carrière' }),
      );
    });
  });

  test('shows the error message', () => {
    renderHub({}, { error: 'Une erreur est survenue.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Une erreur est survenue.');
  });
});
