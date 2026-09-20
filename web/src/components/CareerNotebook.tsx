import type { CareerSong } from '../types';

interface CareerNotebookProps {
  notebook: CareerSong[];
}

// The titles found so far, shown next to the stats and next to the round being played.
export default function CareerNotebook({ notebook }: CareerNotebookProps) {
  if (notebook.length === 0) return null;

  return (
    <div className="career-notebook">
      <h2>{`Carnet (${notebook.length})`}</h2>
      <ul>
        {notebook.map((song) => (
          <li key={song.id}>{song.title}</li>
        ))}
      </ul>
    </div>
  );
}
