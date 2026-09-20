import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import CareerNotebook from './CareerNotebook';

const notebook = [{ id: 1, title: 'Awakening Promise', coverUrl: '/covers/a.png' }];

describe('CareerNotebook', () => {
  test('tells the title to guess is in the notebook, above the list', () => {
    render(<CareerNotebook notebook={notebook} songInNotebook />);

    const indicator = screen.getByText('Ce titre est dans ton carnet');
    const heading = screen.getByRole('heading', { name: 'Carnet (1)' });
    expect(indicator.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('shows no indicator when the title to guess is not in the notebook', () => {
    render(<CareerNotebook notebook={notebook} songInNotebook={false} />);

    expect(screen.queryByText('Ce titre est dans ton carnet')).not.toBeInTheDocument();
  });

  test('shows no indicator outside a round', () => {
    render(<CareerNotebook notebook={notebook} />);

    expect(screen.queryByText('Ce titre est dans ton carnet')).not.toBeInTheDocument();
  });
});
