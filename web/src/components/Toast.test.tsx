import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import Toast from './Toast';

describe('Toast', () => {
  test('shows its message in a status region', () => {
    render(<Toast message="Historique effacé." />);

    expect(screen.getByRole('status')).toHaveTextContent('Historique effacé.');
  });

  test('keeps its live region mounted without a message so screen readers pick up the next one', () => {
    render(<Toast message={null} />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
