import { useEffect, useState } from 'react';
import { fetchGenerations } from '../api';
import type { GenerationOption } from '../types';

export function useGenerationOptions(): GenerationOption[] {
  const [options, setOptions] = useState<GenerationOption[]>([]);

  useEffect(() => {
    fetchGenerations()
      .then(setOptions)
      .catch(() => {});
  }, []);

  return options;
}
