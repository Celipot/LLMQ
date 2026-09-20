import { describe, expect, test } from 'vitest';
import { illustrationFor } from './careerIllustrations';

describe('illustrationFor', () => {
  test('A・ZU・NA has an image for the career, a single, an album and a concert', () => {
    expect(illustrationFor('azuna', 'career')).toEqual({ src: '/units/azuna/career.png', alt: 'Illustration de la carrière' });
    expect(illustrationFor('azuna', 'single')).toEqual({
      src: '/units/azuna/single.png',
      alt: 'Illustration de Se faire connaître',
    });
    expect(illustrationFor('azuna', 'release')).toEqual({ src: '/units/azuna/album.png', alt: "Cover de l'album" });
    expect(illustrationFor('azuna', 'concert')).toEqual({ src: '/units/azuna/concert.png', alt: 'Illustration du concert' });
  });

  test('a study uses the career image', () => {
    expect(illustrationFor('azuna', 'study')).toEqual(illustrationFor('azuna', 'career'));
  });

  test('the finale image is shared by every unit', () => {
    const shared = { src: '/sif-illustration.png', alt: 'Illustration du SIF' };

    expect(illustrationFor('azuna', 'finale')).toEqual(shared);
    expect(illustrationFor('diverdiva', 'finale')).toEqual(shared);
    expect(illustrationFor('qu4rtz', 'finale')).toEqual(shared);
    expect(illustrationFor('r3birth', 'finale')).toEqual(shared);
  });

  test('a unit without its own images gets a neutral placeholder, never the ones of another unit', () => {
    expect(illustrationFor('diverdiva', 'career')).toEqual({ src: '/unit-placeholder.svg', alt: 'Illustration de la carrière' });
    expect(illustrationFor('qu4rtz', 'release')).toEqual({ src: '/unit-placeholder.svg', alt: "Cover de l'album" });
    expect(illustrationFor('r3birth', 'concert')).toEqual({ src: '/unit-placeholder.svg', alt: 'Illustration du concert' });
    expect(illustrationFor('r3birth', 'single')).toEqual({
      src: '/unit-placeholder.svg',
      alt: 'Illustration de Se faire connaître',
    });
  });
});
