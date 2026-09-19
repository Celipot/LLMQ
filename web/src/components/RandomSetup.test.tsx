import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import RandomSetup from './RandomSetup';

const OPTIONS = [
  { generation: 'Aqours', count: 189 },
  { generation: 'Liella', count: 145 },
];

describe('RandomSetup', () => {
  test('shows the generation filter', () => {
    render(<RandomSetup options={OPTIONS} selected={['Aqours']} onChange={vi.fn()} onStart={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /Aqours/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Liella/ })).not.toBeChecked();
  });

  test('forwards selection changes', async () => {
    const onChange = vi.fn();
    render(<RandomSetup options={OPTIONS} selected={['Aqours']} onChange={onChange} onStart={vi.fn()} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /Liella/ }));

    expect(onChange).toHaveBeenCalledWith(['Aqours', 'Liella']);
  });

  test('starts the round when clicking Lancer', async () => {
    const onStart = vi.fn();
    render(<RandomSetup options={OPTIONS} selected={['Aqours']} onChange={vi.fn()} onStart={onStart} />);

    await userEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
