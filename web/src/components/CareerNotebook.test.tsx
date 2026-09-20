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

  test('a solo hint names the singer, above the list', () => {
    render(<CareerNotebook notebook={notebook} hint={{ group: 'Solo', singer: 'Ayumu Uehara' }} />);

    const hint = screen.getByText('Solo : Ayumu Uehara');
    const heading = screen.getByRole('heading', { name: 'Carnet (1)' });
    expect(hint.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('a hint without a singer shows only the group', () => {
    render(<CareerNotebook notebook={notebook} hint={{ group: 'A・ZU・NA' }} />);

    expect(screen.getByText('A・ZU・NA')).toBeInTheDocument();
  });

  test('the hint is shown even when the notebook is still empty', () => {
    render(<CareerNotebook notebook={[]} hint={{ group: 'A・ZU・NA' }} />);

    expect(screen.getByText('A・ZU・NA')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  test('shows no hint when there is none', () => {
    render(<CareerNotebook notebook={notebook} />);

    expect(screen.queryByText(/Solo/)).not.toBeInTheDocument();
  });
});
