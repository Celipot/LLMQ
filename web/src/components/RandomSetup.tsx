import GenerationFilter from './GenerationFilter';
import type { GenerationOption } from '../types';

interface RandomSetupProps {
  options: GenerationOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onStart: () => void;
}

export default function RandomSetup({ options, selected, onChange, onStart }: RandomSetupProps) {
  return (
    <section className="random-setup">
      <p className="subtitle">Choisis les générations à inclure</p>
      <GenerationFilter options={options} selected={selected} onChange={onChange} />
      <button type="button" onClick={onStart}>
        Lancer
      </button>
    </section>
  );
}
