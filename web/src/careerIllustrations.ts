import type { Unit } from './types';

// The kinds of round, plus the hub, which shows the career image.
type IllustrationKind = 'career' | 'study' | 'single' | 'release' | 'concert' | 'finale';
type UnitImage = 'career' | 'single' | 'release' | 'concert';

interface Illustration {
  src: string;
  alt: string;
}

const ALTS: Record<UnitImage | 'finale', string> = {
  career: 'Illustration de la carrière',
  single: 'Illustration de Se faire connaître',
  release: "Cover de l'album",
  concert: 'Illustration du concert',
  finale: 'Illustration du SIF',
};

const SHARED_FINALE_SRC = '/sif-illustration.png';
const PLACEHOLDER_SRC = '/unit-placeholder.svg';

// The images each unit has of its own; anything else shows the neutral placeholder, never the
// image of another unit. The finale is the one image shared by every unit.
const UNIT_IMAGES: Partial<Record<Unit, Partial<Record<UnitImage, string>>>> = {
  azuna: {
    career: '/units/azuna/career.png',
    single: '/units/azuna/single.png',
    release: '/units/azuna/album.png',
    concert: '/units/azuna/concert.png',
  },
};

// A study is played on the career image.
export function illustrationFor(unit: Unit, kind: IllustrationKind): Illustration {
  const shown = kind === 'study' ? 'career' : kind;
  if (shown === 'finale') return { src: SHARED_FINALE_SRC, alt: ALTS.finale };
  return { src: UNIT_IMAGES[unit]?.[shown] ?? PLACEHOLDER_SRC, alt: ALTS[shown] };
}
