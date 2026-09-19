import { useCallback, useEffect, useState } from 'react';

const PROFILE_KEY = 'profile';
const MAX_USERNAME_LENGTH = 20;

export interface Profile {
  username: string;
}

function readProfile(): Profile {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
    return { username: typeof parsed?.username === 'string' ? parsed.username : '' };
  } catch {
    return { username: '' };
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(readProfile);

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

  return { profile, saveUsername };
}
