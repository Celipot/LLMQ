import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import CareerObjective from './CareerObjective';
import type { Career } from '../types';

const goals = {
  concerts: { done: 1, good: 1, required: 2, requiredGood: 2 },
  albums: { done: 2, good: 1, required: 3, requiredGood: 2 },
  met: false,
};

const phase3 = {
  turn: 30,
  concertAt: 20,
  finalTurn: 50,
  releaseAt: 10,
  releaseDue: false,
  concertDue: false,
  phase3: true,
  release: { score: 400, maxScore: 600, grade: 'B', turn: 10, tracks: [] },
  concertResult: { score: 900, maxScore: 1500, grade: 'B', turn: 10, tracks: [] },
  fans: { current: 400, required: 300 },
  failure: null,
  albumGoalGrade: 'B',
  finaleDue: false,
  finaleResult: null,
  finaleGoals: goals,
} as unknown as Career;

describe('CareerObjective in the third phase', () => {
  test('shows the concerts then, on the next line, the albums rated B+ still to release, with the turns left', () => {
    render(<CareerObjective career={phase3} />);

    expect(screen.getByText('Concert B+ 1 / 2')).toBeInTheDocument();
    expect(screen.getByText((text) => text.startsWith('Album B+ 1 / 2'))).toBeInTheDocument();
    expect(screen.getByText('(dans 21 tours)')).toBeInTheDocument();
  });

  test('announces the finale once it is due', () => {
    render(<CareerObjective career={{ ...phase3, turn: 51, finaleDue: true }} />);

    expect(screen.getByText('Donner le SIF')).toBeInTheDocument();
  });

  test('a career whose finale is played is over', () => {
    const finaleResult = { score: 4000, maxScore: 5000, grade: 'A', turn: 10, tracks: [] } as Career['finaleResult'];
    render(<CareerObjective career={{ ...phase3, finaleResult }} />);

    expect(screen.getByText('Carrière terminée')).toBeInTheDocument();
  });

  test('reports the failure when the goals of the finale were missed', () => {
    render(<CareerObjective career={{ ...phase3, failure: 'FINALE_GOALS' }} />);

    expect(screen.getByText(/pas assez de concerts et d'albums/)).toBeInTheDocument();
  });
});
