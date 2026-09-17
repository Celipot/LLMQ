import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import Home from './Home';

describe('Home', () => {
  test('calls onSelectRandom when the random mode card is clicked', async () => {
    const onSelectRandom = vi.fn();
    render(<Home onSelectRandom={onSelectRandom} onSelectList={vi.fn()} />);

    await userEvent.click(screen.getByText('Mode Aléatoire'));

    expect(onSelectRandom).toHaveBeenCalledOnce();
  });

  test('calls onSelectList when the list mode card is clicked', async () => {
    const onSelectList = vi.fn();
    render(<Home onSelectRandom={vi.fn()} onSelectList={onSelectList} />);

    await userEvent.click(screen.getByText('Mode Liste'));

    expect(onSelectList).toHaveBeenCalledOnce();
  });
});
