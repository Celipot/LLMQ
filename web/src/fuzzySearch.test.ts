import { describe, expect, test } from 'vitest';
import { rankMatches } from './fuzzySearch';

const song = (id: number, title: string, artist: string) => ({
  id,
  title,
  artist,
  status: 'not_started' as const,
});

const TITLES = [
  song(1, 'Placeholder Track', 'LLMQ Dev'),
  song(2, 'Été éternel', 'Some Group'),
  song(3, 'Another Song', 'Other Artist'),
];

const titlesOf = (query: string, titles = TITLES) => rankMatches(titles, query).map((t) => t.title);

describe('rankMatches', () => {
  test('ignores case and accents', () => {
    expect(titlesOf('ETE eternel')).toEqual(['Été éternel']);
  });

  test('ranks prefix matches before substring matches', () => {
    const titles = [song(1, 'Song With Ann', 'B'), song(2, 'Anniversary', 'A')];
    expect(titlesOf('ann', titles)).toEqual(['Anniversary', 'Song With Ann']);
  });

  test('ranks substring matches before fuzzy matches', () => {
    const titles = [song(1, 'Placeholdr', 'A'), song(2, 'My Placeholder', 'B')];
    expect(titlesOf('placeholder', titles)).toEqual(['My Placeholder', 'Placeholdr']);
  });

  test('tolerates a missing letter', () => {
    expect(titlesOf('placeholdr trak')).toEqual(['Placeholder Track']);
  });

  test('tolerates a transposition', () => {
    expect(titlesOf('anohter')).toEqual(['Another Song']);
  });

  test('matches words given in a different order', () => {
    expect(titlesOf('track placeholder')).toEqual(['Placeholder Track']);
  });

  test('matches on the artist name with a typo', () => {
    expect(titlesOf('othr artist')).toEqual(['Another Song']);
  });

  test('does not fuzzy-match short tokens', () => {
    expect(titlesOf('sxg')).toEqual([]);
  });

  test('returns nothing for an unrelated query', () => {
    expect(titlesOf('zzzzzzzz')).toEqual([]);
  });

  test('caps the result list at 5', () => {
    const many = Array.from({ length: 20 }, (_, i) => song(i, `Anniversary ${i}`, 'A'));
    expect(rankMatches(many, 'ann')).toHaveLength(5);
  });
});
