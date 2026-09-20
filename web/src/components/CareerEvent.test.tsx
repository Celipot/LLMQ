import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import CareerEvent from './CareerEvent';
import type { PendingChoice } from '../types';

const choice: PendingChoice = {
  eventId: 10,
  options: { stats: { amount: 60 }, energy: { amount: 4 } },
};

describe('CareerEvent', () => {
  test('shows the placeholder image, the short text and a Continuer button', async () => {
    const onContinue = vi.fn();
    render(<CareerEvent event={{ id: 1, text: 'Énergie +2' }} choice={null} onContinue={onContinue} onChoose={vi.fn()} />);

    expect(screen.getByRole('img', { name: "Illustration de l'événement" })).toHaveAttribute(
      'src',
      '/career-event-placeholder.svg',
    );
    expect(screen.getByText('Énergie +2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  test('a pending choice offers the two rewards instead of Continuer', async () => {
    const onChoose = vi.fn();
    render(<CareerEvent event={null} choice={choice} onContinue={vi.fn()} onChoose={onChoose} />);

    expect(screen.queryByRole('button', { name: 'Continuer' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Toutes les stats +60' }));
    await userEvent.click(screen.getByRole('button', { name: 'Énergie +4' }));

    expect(onChoose).toHaveBeenNthCalledWith(1, 'stats');
    expect(onChoose).toHaveBeenNthCalledWith(2, 'energy');
  });

  test('renders nothing without an event nor a choice', () => {
    const { container } = render(<CareerEvent event={null} choice={null} onContinue={vi.fn()} onChoose={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
