import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import GenerationFilter from './GenerationFilter';

const OPTIONS = [
  { generation: "µ's", count: 118 },
  { generation: 'Aqours', count: 189 },
  { generation: 'Liella', count: 145 },
];

describe('GenerationFilter', () => {
  test('renders one checkbox per generation with its song count', () => {
    render(<GenerationFilter options={OPTIONS} selected={["µ's", 'Aqours', 'Liella']} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: "µ's (118)" })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Aqours (189)' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Liella (145)' })).toBeInTheDocument();
  });

  test('checks only the selected generations', () => {
    render(<GenerationFilter options={OPTIONS} selected={['Aqours']} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /Aqours/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Liella/ })).not.toBeChecked();
  });

  test('unchecking a generation reports the selection without it', async () => {
    const onChange = vi.fn();
    render(<GenerationFilter options={OPTIONS} selected={['Aqours', 'Liella']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: /Liella/ }));

    expect(onChange).toHaveBeenCalledWith(['Aqours']);
  });

  test('checking a generation reports the selection with it, in the options order', async () => {
    const onChange = vi.fn();
    render(<GenerationFilter options={OPTIONS} selected={['Liella']} onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox', { name: "µ's (118)" }));

    expect(onChange).toHaveBeenCalledWith(["µ's", 'Liella']);
  });

  test('the last selected generation cannot be unchecked', () => {
    render(<GenerationFilter options={OPTIONS} selected={['Aqours']} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /Aqours/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Liella/ })).toBeEnabled();
  });

  test('every checkbox is disabled when the filter is read-only', () => {
    render(<GenerationFilter options={OPTIONS} selected={['Aqours', 'Liella']} onChange={vi.fn()} disabled />);

    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled();
    }
  });
});
