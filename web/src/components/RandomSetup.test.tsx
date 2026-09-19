import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import RandomSetup from './RandomSetup';

const OPTIONS = [
  { generation: 'Aqours', count: 189 },
  { generation: 'Liella', count: 145 },
];

function renderSetup(overrides: Partial<React.ComponentProps<typeof RandomSetup>> = {}) {
  const props = {
    options: OPTIONS,
    selected: ['Aqours'],
    onChange: vi.fn(),
    adaptive: true,
    onAdaptiveChange: vi.fn(),
    onClearHistory: vi.fn(),
    onStart: vi.fn(),
    ...overrides,
  };
  render(<RandomSetup {...props} />);
  return props;
}

describe('RandomSetup', () => {
  test('shows the generation filter', () => {
    renderSetup();

    expect(screen.getByRole('checkbox', { name: /Aqours/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Liella/ })).not.toBeChecked();
  });

  test('forwards selection changes', async () => {
    const { onChange } = renderSetup();

    await userEvent.click(screen.getByRole('checkbox', { name: /Liella/ }));

    expect(onChange).toHaveBeenCalledWith(['Aqours', 'Liella']);
  });

  test('starts the round when clicking Lancer', async () => {
    const { onStart } = renderSetup();

    await userEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('shows the adaptive draw option as checked when it is enabled', () => {
    renderSetup({ adaptive: true });

    expect(screen.getByRole('checkbox', { name: /Tirage adaptatif/ })).toBeChecked();
  });

  test('toggling the adaptive draw reports the new value', async () => {
    const { onAdaptiveChange } = renderSetup({ adaptive: true });

    await userEvent.click(screen.getByRole('checkbox', { name: /Tirage adaptatif/ }));

    expect(onAdaptiveChange).toHaveBeenCalledWith(false);
  });

  test('clicking "Effacer mon historique" asks to clear the history', async () => {
    const { onClearHistory } = renderSetup();

    await userEvent.click(screen.getByRole('button', { name: 'Effacer mon historique' }));

    expect(onClearHistory).toHaveBeenCalledTimes(1);
  });
});
