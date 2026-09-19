import { useCallback, useEffect, useState } from 'react';
import { resizeImageToDataUrl } from '../imageResize';

const PROFILE_KEY = 'profile';
const MAX_USERNAME_LENGTH = 20;

export interface Profile {
  username: string;
  // Small square JPEG as a data URL, produced by resizeImageToDataUrl.
  avatar?: string;
}

function readProfile(): Profile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
    return {
      username: typeof parsed?.username === 'string' ? parsed.username : '',
      avatar: typeof parsed?.avatar === 'string' ? parsed.avatar : undefined,
    };
  } catch {
    return { username: '' };
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Storage blocked (private mode): the profile just is not remembered.
    }
  }, [profile]);

  const saveUsername = useCallback((username: string) => {
    setProfile((previous) => ({ ...previous, username: username.trim().slice(0, MAX_USERNAME_LENGTH) }));
  }, []);

  const chooseAvatar = useCallback(async (file: File) => {
    try {
      const avatar = await resizeImageToDataUrl(file);
      setAvatarError(null);
      setProfile((previous) => ({ ...previous, avatar }));
    } catch {
      setAvatarError("Cette image n'a pas pu être utilisée (PNG, JPEG ou WebP).");
    }
  }, []);

  const removeAvatar = useCallback(() => {
    setAvatarError(null);
    setProfile((previous) => ({ ...previous, avatar: undefined }));
  }, []);

  return { profile, avatarError, saveUsername, chooseAvatar, removeAvatar };
}
