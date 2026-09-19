import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ProfileEditor from './ProfileEditor';

describe('ProfileEditor', () => {
  test('shows the current username', () => {
    render(<ProfileEditor username="Alice" onSave={vi.fn()} />);

    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveValue('Alice');
  });

  test('limits the username to 20 characters', () => {
    render(<ProfileEditor username="" onSave={vi.fn()} />);

    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveAttribute('maxlength', '20');
  });

  test('saves the typed username and confirms it', async () => {
    const onSave = vi.fn();
    render(<ProfileEditor username="" onSave={onSave} />);

    await userEvent.type(screen.getByLabelText("Nom d'utilisateur"), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledWith('Alice');
    expect(screen.getByRole('status')).toHaveTextContent('Profil enregistré');
  });

  test('refuses an empty username', async () => {
    const onSave = vi.fn();
    render(<ProfileEditor username="" onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("Entre un nom d'utilisateur");
  });
});
