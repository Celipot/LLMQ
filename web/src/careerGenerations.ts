import type { Generation } from './types';

// The franchises a career (classic, through its unit, or infinite, directly) can follow.
// 'all' only applies to the infinite mode: no unit spans every franchise at once.
export const CAREER_GENERATIONS: { generation: Generation; label: string }[] = [
  { generation: 'nijigasaki', label: 'Nijigasaki' },
  { generation: 'mus', label: "µ's" },
  { generation: 'aqours', label: 'Aqours' },
  { generation: 'hasunosora', label: 'Hasunosora' },
  { generation: 'liella', label: 'Liella' },
  { generation: 'ikizulive', label: 'Ikizulive' },
  { generation: 'all', label: 'Toutes' },
];
