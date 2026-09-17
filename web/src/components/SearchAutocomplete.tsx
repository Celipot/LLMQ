import { useState } from 'react';
import type { KeyboardEvent } from 'react';

interface SearchAutocompleteProps {
  titles: string[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export default function SearchAutocomplete({ titles, value, disabled, onChange, onSubmit }: SearchAutocompleteProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  const matches = value.trim() && open ? titles.filter((t) => normalize(t).includes(normalize(value))) : [];

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
        select(matches[activeIndex]);
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
          {matches.map((title, i) => (
            <li
              key={title}
              className={i === activeIndex ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                select(title);
              }}
            >
              {title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
