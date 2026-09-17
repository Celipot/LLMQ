import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { PlayableSong } from '../types';

interface SearchAutocompleteProps {
  titles: PlayableSong[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

const MAX_RESULTS = 8;

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Ranks title/artist-starts-with matches above mid-string matches (so a cap
// doesn't just show arbitrary hits), preserving each group's relative order.
function rankMatches(titles: PlayableSong[], query: string): PlayableSong[] {
  const normalizedQuery = normalize(query);
  const starts: PlayableSong[] = [];
  const contains: PlayableSong[] = [];

  for (const t of titles) {
    const normalizedTitle = normalize(t.title);
    const normalizedArtist = normalize(t.artist);
    if (normalizedTitle.startsWith(normalizedQuery) || normalizedArtist.startsWith(normalizedQuery)) {
      starts.push(t);
    } else if (`${normalizedTitle} ${normalizedArtist}`.includes(normalizedQuery)) {
      contains.push(t);
    }
  }

  return [...starts, ...contains].slice(0, MAX_RESULTS);
}

export default function SearchAutocomplete({ titles, value, disabled, onChange, onSubmit }: SearchAutocompleteProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  const matches = value.trim() && open ? rankMatches(titles, value) : [];

  function select(title: string) {
    onChange(title);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matches.length) setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length) setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && matches[activeIndex]) {
        e.preventDefault();
        select(matches[activeIndex].title);
      } else {
        onSubmit();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="autocomplete">
      <input
        id="title-input"
        type="text"
        autoComplete="off"
        placeholder="Titre de la chanson..."
        aria-label="Rechercher un titre"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
      />
      {matches.length > 0 && (
        <ul className="suggestions">
          {matches.map((match, i) => (
            <li
              key={match.title}
              className={i === activeIndex ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                select(match.title);
              }}
            >
              {match.title} — {match.artist}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
