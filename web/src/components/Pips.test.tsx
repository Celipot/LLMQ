import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import Pips from './Pips';
import type { GuessEntry } from '../types';

describe('Pips', () => {
  test('renders one pip per attempt except the final one, unused ones plain', () => {
    const { container } = render(<Pips maxAttempts={6} guesses={[]} />);
    const pips = container.querySelectorAll('.pip');
    expect(pips).toHaveLength(5);
    pips.forEach((pip) => {
      expect(pip.className.trim()).toBe('pip');
    });
  });

  test('marks correct, wrong, and skip pips distinctly, in order', () => {
    const guesses: GuessEntry[] = [
      { type: 'guess', title: 'Wrong', correct: false },
      { type: 'skip', title: null, correct: null },
      { type: 'guess', title: 'Right', correct: true },
    ];
    const { container } = render(<Pips maxAttempts={6} guesses={guesses} />);
    const pips = container.querySelectorAll('.pip');
    expect(pips[0]).toHaveClass('used-wrong');
    expect(pips[1]).toHaveClass('used-skip');
    expect(pips[2]).toHaveClass('used-correct');
    expect(pips[3].className.trim()).toBe('pip');
  });

  test('the 6th and final attempt never gets its own pip', () => {
    const guesses: GuessEntry[] = Array.from({ length: 6 }, () => ({
      type: 'skip' as const,
      title: null,
      correct: null,
    }));
    const { container } = render(<Pips maxAttempts={6} guesses={guesses} />);
    expect(container.querySelectorAll('.pip')).toHaveLength(5);
  });
});
