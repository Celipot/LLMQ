import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import History from './History';
import type { GuessEntry } from '../types';

describe('History', () => {
  test('renders a guess entry with its title', () => {
    const guesses: GuessEntry[] = [{ type: 'guess', title: 'Placeholder Track', correct: false }];
    render(<History guesses={guesses} />);
    expect(screen.getByText('Placeholder Track')).toBeInTheDocument();
  });

  test('renders a skip entry as "Skip", never a title', () => {
    const guesses: GuessEntry[] = [{ type: 'skip', title: null, correct: null }];
    render(<History guesses={guesses} />);
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  test('numbers entries in order starting at 1', () => {
    const guesses: GuessEntry[] = [
      { type: 'guess', title: 'A', correct: false },
      { type: 'skip', title: null, correct: null },
    ];
    render(<History guesses={guesses} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});
