import type { PlayableSong } from './types';

const MAX_RESULTS = 5;

export function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function tokenize(str: string): string[] {
  return str.split(/[^a-z0-9]+/).filter(Boolean);
}

// Optimal string alignment distance: insert/delete/substitute/transpose = 1.
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => [i, ...new Array<number>(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Short tokens get no tolerance: with so few letters, any typo would match too much.
function maxTypos(tokenLength: number): number {
  if (tokenLength <= 3) return 0;
  return tokenLength <= 6 ? 1 : 2;
}

// Distance of a query token to the closest song token, comparing against the
// token's prefix too so a partially typed word still matches. null = too far.
function tokenDistance(queryToken: string, songTokens: string[]): number | null {
  let best = Infinity;
  for (const st of songTokens) {
    best = Math.min(best, editDistance(queryToken, st), editDistance(queryToken, st.slice(0, queryToken.length)));
  }
  return best <= maxTypos(queryToken.length) ? best : null;
}

function fuzzyDistance(queryTokens: string[], songTokens: string[]): number | null {
  let total = 0;
  for (const qt of queryTokens) {
    const dist = tokenDistance(qt, songTokens);
    if (dist === null) return null;
    total += dist;
  }
  return total;
}

// Ranks prefix matches, then substring matches, then typo-tolerant matches
// (closest first), preserving original order within each group.
export function rankMatches(titles: PlayableSong[], query: string): PlayableSong[] {
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(normalizedQuery);
  const starts: PlayableSong[] = [];
  const contains: PlayableSong[] = [];
  const fuzzy: { song: PlayableSong; distance: number }[] = [];

  for (const t of titles) {
    const normalizedTitle = normalize(t.title);
    const normalizedArtist = normalize(t.artist);
    const combined = `${normalizedTitle} ${normalizedArtist}`;

    if (normalizedTitle.startsWith(normalizedQuery) || normalizedArtist.startsWith(normalizedQuery)) {
      starts.push(t);
    } else if (combined.includes(normalizedQuery)) {
      contains.push(t);
    } else if (queryTokens.length) {
      const distance = fuzzyDistance(queryTokens, tokenize(combined));
      if (distance !== null) fuzzy.push({ song: t, distance });
    }
  }

  fuzzy.sort((a, b) => a.distance - b.distance);
  return [...starts, ...contains, ...fuzzy.map((f) => f.song)].slice(0, MAX_RESULTS);
}
