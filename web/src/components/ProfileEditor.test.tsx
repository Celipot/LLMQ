import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ProfileEditor from './ProfileEditor';

describe('ProfileEditor', () => {
  test('shows the current username', () => {
    render(<ProfileEditor onAvatarFile={vi.fn()} onAvatarRemove={vi.fn()} username="Alice" onSave={vi.fn()} />);

    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveValue('Alice');
  });

  test('limits the username to 20 characters', () => {
    render(<ProfileEditor onAvatarFile={vi.fn()} onAvatarRemove={vi.fn()} username="" onSave={vi.fn()} />);

    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveAttribute('maxlength', '20');
  });

  test('saves the typed username and confirms it', async () => {
    const onSave = vi.fn();
    render(<ProfileEditor onAvatarFile={vi.fn()} onAvatarRemove={vi.fn()} username="" onSave={onSave} />);

    await userEvent.type(screen.getByLabelText("Nom d'utilisateur"), 'Alice');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledWith('Alice');
    expect(screen.getByRole('status')).toHaveTextContent('Profil enregistré');
  });

  test('refuses an empty username', async () => {
    const onSave = vi.fn();
    render(<ProfileEditor onAvatarFile={vi.fn()} onAvatarRemove={vi.fn()} username="" onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent("Entre un nom d'utilisateur");
  });

  describe('picture', () => {
    test('previews the current picture and offers to remove it', async () => {
      const onAvatarRemove = vi.fn();
      render(
        <ProfileEditor
          username="Alice"
          avatar="data:image/jpeg;base64,AAAA"
          onSave={vi.fn()}
          onAvatarFile={vi.fn()}
          onAvatarRemove={onAvatarRemove}
        />
      );

      expect(screen.getByRole('img', { name: 'Ta photo de profil' })).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
      await userEvent.click(screen.getByRole('button', { name: 'Retirer la photo' }));
      expect(onAvatarRemove).toHaveBeenCalledOnce();
    });

    test('shows no preview and no remove button without a picture', () => {
      render(<ProfileEditor username="Alice" onSave={vi.fn()} onAvatarFile={vi.fn()} onAvatarRemove={vi.fn()} />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retirer la photo' })).not.toBeInTheDocument();
    });

    test('only offers PNG, JPEG and WebP files', () => {
      render(<ProfileEditor username="Alice" onSave={vi.fn()} onAvatarFile={vi.fn()} onAvatarRemove={vi.fn()} />);

      expect(screen.getByLabelText('Photo de profil')).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
    });

    test('hands the chosen file over', async () => {
      const onAvatarFile = vi.fn();
      render(<ProfileEditor username="Alice" onSave={vi.fn()} onAvatarFile={onAvatarFile} onAvatarRemove={vi.fn()} />);
      const file = new File(['x'], 'me.png', { type: 'image/png' });

      await userEvent.upload(screen.getByLabelText('Photo de profil'), file);

      expect(onAvatarFile).toHaveBeenCalledWith(file);
    });

    test('shows why a picture was refused', () => {
      render(
        <ProfileEditor
          username="Alice"
          avatarError="Image non prise en charge."
          onSave={vi.fn()}
          onAvatarFile={vi.fn()}
          onAvatarRemove={vi.fn()}
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Image non prise en charge.');
    });
  });
});
