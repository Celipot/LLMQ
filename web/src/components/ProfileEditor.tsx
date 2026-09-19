import { useState } from 'react';

const MAX_USERNAME_LENGTH = 20;

interface ProfileEditorProps {
  username: string;
  avatar?: string;
  avatarError?: string | null;
  onSave: (username: string) => void;
  onAvatarFile: (file: File) => void;
  onAvatarRemove: () => void;
}

export default function ProfileEditor({
  username,
  avatar,
  avatarError,
  onSave,
  onAvatarFile,
  onAvatarRemove,
}: ProfileEditorProps) {
  const [draft, setDraft] = useState(username);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (draft.trim() === '') {
      setSaved(false);
      setError("Entrer un nom d'utilisateur.");
      return;
    }
    setError(null);
    onSave(draft);
    setSaved(true);
  }

  return (
    <section className="profile-editor">
      <p className="subtitle">Ton profil</p>
      <label className="setting-field">
        <span>Nom d'utilisateur</span>
        <input
          type="text"
          maxLength={MAX_USERNAME_LENGTH}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <button type="button" onClick={handleSave}>
        Enregistrer
      </button>
      {saved && <p role="status">Profil enregistré.</p>}
      {error && (
        <p className="error-msg" role="alert">
          {error}
        </p>
      )}

      <div className="profile-picture">
        {avatar && <img className="profile-picture-preview" src={avatar} alt="Ta photo de profil" />}
        <label className="setting-field">
          <span>Photo de profil</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAvatarFile(file);
              event.target.value = '';
            }}
          />
        </label>
        {avatar && (
          <button type="button" className="secondary" onClick={onAvatarRemove}>
            Retirer la photo
          </button>
        )}
        {avatarError && (
          <p className="error-msg" role="alert">
            {avatarError}
          </p>
        )}
      </div>
    </section>
  );
}
