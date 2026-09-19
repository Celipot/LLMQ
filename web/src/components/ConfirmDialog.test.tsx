import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    title: 'Quitter la partie ?',
    message: 'La partie en cours sera supprimée.',
    confirmLabel: 'Quitter',
    cancelLabel: 'Continuer',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<ConfirmDialog {...props} />);
  return props;
}

describe('ConfirmDialog', () => {
  test('is announced as a modal alert dialog named by its title and described by its message', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Quitter la partie ?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('La partie en cours sera supprimée.');
  });

  test('the confirm button calls onConfirm', async () => {
    const { onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Quitter' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('the cancel button calls onCancel', async () => {
    const { onCancel } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('Escape calls onCancel', async () => {
    const { onCancel } = renderDialog();

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('the safe choice (cancel) has the focus when the dialog opens', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Continuer' })).toHaveFocus();
  });

  test('Tab keeps the focus inside the dialog', async () => {
    renderDialog();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Quitter' })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Continuer' })).toHaveFocus();
  });
});
