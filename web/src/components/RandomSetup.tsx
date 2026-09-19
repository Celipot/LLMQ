import GenerationFilter from './GenerationFilter';
import type { GenerationOption } from '../types';

interface RandomSetupProps {
  options: GenerationOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  adaptive: boolean;
  onAdaptiveChange: (adaptive: boolean) => void;
  onClearHistory: () => void;
  onStart: () => void;
}

export default function RandomSetup({
  options,
  selected,
  onChange,
  adaptive,
  onAdaptiveChange,
  onClearHistory,
  onStart,
}: RandomSetupProps) {
  return (
    <section className="random-setup">
      <p className="subtitle">Choisis les générations à inclure</p>
      <GenerationFilter options={options} selected={selected} onChange={onChange} />
      <label className="adaptive-draw">
        <input type="checkbox" checked={adaptive} onChange={(event) => onAdaptiveChange(event.target.checked)} />
        Tirage adaptatif (revoir plus souvent les chansons difficiles ou pas jouées depuis longtemps)
      </label>
      <button type="button" className="secondary" onClick={onClearHistory}>
        Effacer mon historique
      </button>
      <button type="button" onClick={onStart}>
        Lancer
      </button>
    </section>
  );
}
