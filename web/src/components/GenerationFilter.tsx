import type { GenerationOption } from '../types';

interface GenerationFilterProps {
  options: GenerationOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export default function GenerationFilter({ options, selected, onChange, disabled = false }: GenerationFilterProps) {
  function toggle(generation: string) {
    const next = selected.includes(generation)
      ? selected.filter((g) => g !== generation)
      : options.map((option) => option.generation).filter((g) => g === generation || selected.includes(g));
    onChange(next);
  }

  return (
    <fieldset className="generation-filter">
      <legend>Générations</legend>
      {options.map(({ generation, count }) => {
        const checked = selected.includes(generation);
        const isLastChecked = checked && selected.length === 1;
        return (
          <label key={generation}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled || isLastChecked}
              onChange={() => toggle(generation)}
            />
            {`${generation} (${count})`}
          </label>
        );
      })}
    </fieldset>
  );
}
