import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { PlayableSong } from '../types';
import { rankMatches } from '../fuzzySearch';

interface SearchAutocompleteProps {
  titles: PlayableSong[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  maxSuggestions?: number;
}

export default function SearchAutocomplete({
  titles,
  value,
  disabled,
  onChange,
  onSubmit,
  maxSuggestions,
}: SearchAutocompleteProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  const matches = value.trim() && open ? rankMatches(titles, value, maxSuggestions) : [];

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
