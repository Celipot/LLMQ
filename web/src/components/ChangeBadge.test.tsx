import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import ChangeBadge from './ChangeBadge';

describe('ChangeBadge', () => {
  test('shows a gain with a plus sign', () => {
    render(<ChangeBadge label="Oreille" amount={50} />);

    expect(screen.getByRole('status', { name: 'Oreille +50' })).toHaveTextContent('+50');
  });

  test('shows a loss with a minus sign', () => {
    render(<ChangeBadge label="Culture" amount={-500} />);

    expect(screen.getByRole('status', { name: 'Culture −500' })).toHaveTextContent('−500');
  });

  test('marks a gain and a loss differently', () => {
    render(
      <>
        <ChangeBadge label="Fans" amount={40} />
        <ChangeBadge label="Énergie" amount={-2} />
      </>,
    );

    expect(screen.getByRole('status', { name: 'Fans +40' })).toHaveClass('gain');
    expect(screen.getByRole('status', { name: 'Énergie −2' })).toHaveClass('loss');
  });
});
