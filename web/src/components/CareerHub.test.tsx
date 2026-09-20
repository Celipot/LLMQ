import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import CareerHub from './CareerHub';
import type { Career, CareerResult } from '../types';

const career: Career = {
  turn: 3,
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
  energy: 2,
  maxEnergy: 4,
  stats: { oreille: 80, memoire: 0, culture: 130 },
  suggestionCount: 1,
  costs: { study: 1, single: 2 },
  statStep: 100,
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
  finalScore: null,
};

const albumResult: CareerResult = {
  score: 420,
  maxScore: 600,
  grade: 'A',
  turn: 10,
  tracks: [
    { song: { id: 1, title: 'Dream with You', coverUrl: '/covers/d.png' }, rank: 'S', points: 100 },
    { song: { id: 2, title: 'Kaika Sengen', coverUrl: '/covers/k.png' }, rank: 'FAIL', points: 0 },
  ],
};

const concertResult: CareerResult = {
  score: 1350,
  maxScore: 1500,
  grade: 'S',
  turn: 20,
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
    onFinale: vi.fn(),
    onDismissEvent: vi.fn(),
    onChooseReward: vi.fn(),
  };
  render(
    <CareerHub
      career={overrides === null ? null : { ...career, ...overrides }}
      error={null}
      events={[]}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('CareerHub', () => {
  test('without a career, offers to start one', async () => {
    const { onBegin } = renderHub(null);

    await userEvent.click(screen.getByRole('button', { name: 'Commencer une carrière' }));

    expect(onBegin).toHaveBeenCalledOnce();
  });

  test('without a career, presents the career of A・ZU・NA', () => {
    renderHub(null);

    expect(screen.getByText(/Suivre la carrière d'A・ZU・NA/)).toBeInTheDocument();
  });

  test('shows only the current turn, without the total', () => {
    renderHub();

    expect(screen.getByText('Tour 3')).toBeInTheDocument();
    expect(screen.queryByText(/\/ 20/)).not.toBeInTheDocument();
  });

  test('shows the energy', () => {
    renderHub();

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

  test('the energy a single or a study needs is the one sent by the server', () => {
    renderHub({ energy: 2, costs: { study: 3, single: 3 } });

    expect(screen.getByRole('button', { name: 'Sortir un single' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Étudier : Oreille' })).toBeDisabled();
  });

  test('with only 1 energy a single is disabled but a study is not', () => {
    renderHub({ energy: 1 });

    expect(screen.getByRole('button', { name: 'Sortir un single' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Étudier : Oreille' })).toBeEnabled();
  });

  test('the restart button is not part of the hub, it lives in the app header', () => {
    renderHub();

    expect(screen.queryByRole('button', { name: 'Recommencer la carrière' })).not.toBeInTheDocument();
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

    test('once played shows its grade and score in the recap, and the career goes on', async () => {
      renderHub({
        ...due,
        concertDue: false,
        phase3: true,
        concert: { done: 15, total: 15 },
        concertResult,
      });

      expect(screen.getByText('Grade S')).toBeVisible();
      expect(screen.getByText('Score 1350 / 1500')).not.toBeVisible();
      await userEvent.click(screen.getByText('Concert'));
      expect(screen.getByText('Score 1350 / 1500')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Nouvelle carrière' })).not.toBeInTheDocument();
    });
  });

  test('shows only the current number of fans, without the required total', () => {
    renderHub();

    expect(screen.getByText('Fans 120')).toBeInTheDocument();
    expect(screen.queryByText('Fans 120 / 300')).not.toBeInTheDocument();
  });

  describe('the current objective', () => {
    const objective = () => screen.getByRole('region', { name: 'Objectif en cours' });

    test('before the album: release it with at least the grade B, with the turns left', () => {
      renderHub();

      expect(objective()).toHaveTextContent("Sortir l'album avec un grade B ou mieux");
      expect(objective()).toHaveTextContent('(dans 8 tours)');
    });

    test('the last turn before the album is singular', () => {
      renderHub({ turn: 10 });

      expect(objective()).toHaveTextContent('(dans 1 tour)');
      expect(objective()).not.toHaveTextContent('1 tours');
    });

    test('once the album is due there is no deadline left to show', () => {
      renderHub({ turn: 11, releaseDue: true });

      expect(objective()).not.toHaveTextContent('(dans');
    });

    test('once the album is released: win the fans needed for the concert', () => {
      renderHub({ turn: 12, release: albumResult });

      expect(objective()).toHaveTextContent('Atteindre 300 fans pour participer au concert (120 / 300)');
      expect(objective()).toHaveTextContent('(dans 9 tours)');
    });

    test('once the concert is due: give it', () => {
      renderHub({ turn: 21, release: albumResult, concertDue: true });

      expect(objective()).toHaveTextContent('Donner le concert');
      expect(objective()).not.toHaveTextContent('(dans');
    });

    test('once the concert is over the goals of the finale are shown', () => {
      renderHub({ turn: 21, release: albumResult, phase3: true, concertResult });

      expect(within(objective()).getByText('Concert B+ 0 / 2')).toBeInTheDocument();
      expect(within(objective()).getByText((text) => text.startsWith('Album B+ 0 / 2'))).toBeInTheDocument();
      expect(objective()).toHaveTextContent('(dans 30 tours)');
    });

    test('once the finale is over the career is complete', () => {
      renderHub({ turn: 51, release: albumResult, concertResult, finaleResult: concertResult });

      expect(objective()).toHaveTextContent('Carrière terminée');
      expect(objective()).not.toHaveTextContent('(dans');
    });

    test('a failed album is reported as a missed objective', () => {
      renderHub({ turn: 11, release: albumResult, failure: 'ALBUM_GRADE' });

      expect(objective()).toHaveTextContent("Objectif raté : l'album n'a pas atteint le grade B");
    });

    test('missing fans is reported as a missed objective', () => {
      renderHub({ turn: 21, release: albumResult, failure: 'FANS' });

      expect(objective()).toHaveTextContent('Objectif raté : pas assez de fans pour participer au concert (120 / 300)');
    });
  });

  describe('the final score', () => {
    const finalScore = { album: 420, concert: 1000, sorties: 0, finale: 0, stats: 170, fans: 200, total: 1790 };
    const over = { turn: 21, release: albumResult, concertResult, finaleResult: concertResult, finalScore };

    test('is shown at the end, with what it is made of', () => {
      renderHub(over);

      const score = screen.getByRole('region', { name: 'Score de carrière' });
      expect(within(score).getByText('1790')).toBeInTheDocument();
      expect(within(score).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Album : 420',
        'Concert : 1000',
        'Sorties : 0',
        'SIF : 0',
        'Stats : 170',
        'Fans : 200',
      ]);
    });

    test('is also shown when the career failed', () => {
      renderHub({ turn: 21, release: albumResult, failure: 'FANS', finalScore });

      expect(screen.getByRole('region', { name: 'Score de carrière' })).toBeInTheDocument();
    });

    test('is not shown while the career goes on', () => {
      renderHub();

      expect(screen.queryByRole('region', { name: 'Score de carrière' })).not.toBeInTheDocument();
    });
  });

  describe('a failed career', () => {
    const failed = { turn: 21, release: albumResult, failure: 'FANS' as const };

    test('offers only a new career', async () => {
      const { onBegin } = renderHub(failed);

      expect(screen.queryByRole('button', { name: 'Se reposer' })).not.toBeInTheDocument();
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

    test('once the career is over the new career button stays in the middle', () => {
      renderHub({ ...finished, failure: 'FINALE_GOALS' });

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

describe('CareerHub third phase', () => {
  const phase3: Partial<Career> = {
    turn: 25,
    phase3: true,
    energy: 4,
    release: albumResult,
    concertResult,
  };

  test('offers an album and a concert, with their energy cost', async () => {
    const { onRelease, onConcert } = renderHub(phase3);

    await userEvent.click(screen.getByRole('button', { name: 'Sortir un album (3 énergies)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Donner un concert (4 énergies)' }));

    expect(onRelease).toHaveBeenCalledOnce();
    expect(onConcert).toHaveBeenCalledOnce();
  });

  test('disables a sortie the energy cannot pay', () => {
    renderHub({ ...phase3, energy: 3 });

    expect(screen.getByRole('button', { name: 'Sortir un album (3 énergies)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Donner un concert (4 énergies)' })).toBeDisabled();
  });

  test('offers no album nor concert before the concert of the second phase', () => {
    renderHub({ turn: 5, energy: 4 });

    expect(screen.queryByRole('button', { name: /Sortir un album/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Donner un concert/ })).not.toBeInTheDocument();
  });

  test('a sortie in progress can only be continued', async () => {
    const { onRelease } = renderHub({ ...phase3, live: { kind: 'album', done: 2, total: 6 } });

    await userEvent.click(screen.getByRole('button', { name: "Poursuivre l'album (2 / 6)" }));

    expect(onRelease).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Se reposer/ })).not.toBeInTheDocument();
  });

  test('once the finale is due, only the SIF can be launched', async () => {
    const { onFinale } = renderHub({ ...phase3, turn: 51, finaleDue: true });

    await userEvent.click(screen.getByRole('button', { name: 'Lancer le SIF' }));

    expect(onFinale).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Se reposer/ })).not.toBeInTheDocument();
  });

  test('a finale in progress can be continued', () => {
    renderHub({ ...phase3, turn: 51, finaleDue: true, live: { kind: 'finale', done: 10, total: 50 } });

    expect(screen.getByRole('button', { name: 'Poursuivre le SIF (10 / 50)' })).toBeInTheDocument();
  });

  test('keeps the turn at the last one once the third phase is over', () => {
    renderHub({ ...phase3, turn: 51, finaleDue: true });

    expect(screen.getByText('Tour 50')).toBeInTheDocument();
  });

  test('lists every sortie of the third phase on the right, with its grade', () => {
    renderHub({
      ...phase3,
      sorties: [
        { kind: 'album', ...albumResult },
        { kind: 'concert', ...concertResult },
      ],
    });

    const recaps = screen.getByRole('complementary', { name: 'Récapitulatifs' });
    expect(within(recaps).getAllByText(/Album|Concert/).length).toBeGreaterThanOrEqual(4);
  });

  test('a played finale ends the career: score and new career', () => {
    renderHub({
      ...phase3,
      finaleResult: { ...concertResult, maxScore: 5000 },
      finalScore: { album: 1, concert: 1, sorties: 1, finale: 1, stats: 1, fans: 1, total: 6 },
    });

    expect(screen.getByRole('button', { name: 'Nouvelle carrière' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sortir un album/ })).not.toBeInTheDocument();
  });

  test('the left column dates every release with the turn it was played on', () => {
    renderHub({
      ...phase3,
      sorties: [
        { kind: 'album', ...albumResult, turn: 24 },
        { kind: 'concert', ...concertResult, turn: 27 },
      ],
      finaleResult: { ...concertResult, turn: 50 },
    });

    const left = screen.getByRole('complementary', { name: 'Statistiques' });
    expect(within(left).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      expect.arrayContaining(['Album : tour 10', 'Concert : tour 20', 'Album : tour 24', 'Concert : tour 27', 'SIF : tour 50']),
    );
  });

  test('shows the event to acknowledge, one at a time', async () => {
    const { onDismissEvent } = renderHub({}, { events: [{ id: 1, text: 'Énergie +2' }, { id: 2, text: 'Carnet +1' }] });

    expect(screen.getByText('Énergie +2')).toBeInTheDocument();
    expect(screen.queryByText('Carnet +1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(onDismissEvent).toHaveBeenCalledOnce();
  });

  test('a pending series choice offers the rewards and calls onChooseReward', async () => {
    const { onChooseReward } = renderHub({
      pendingChoice: { eventId: 10, options: { stats: { amount: 60 }, energy: { amount: 4 } } },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Toutes les stats +60' }));

    expect(onChooseReward).toHaveBeenCalledWith('stats');
  });
});

describe('CareerHub — changes of the last round', () => {
  test('a badge sits on every field that moved', () => {
    renderHub({}, { changes: { stats: { oreille: 50, culture: -100 }, energy: 2, fans: 40 } });

    expect(screen.getByRole('status', { name: 'Oreille +50' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Culture −100' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Énergie +2' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Fans +40' })).toBeInTheDocument();
  });

  test('fields that did not move get no badge', () => {
    renderHub({}, { changes: { stats: { oreille: 50 }, energy: 0, fans: 0 } });

    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  test('without changes, no badge is shown', () => {
    renderHub({}, { changes: null });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
