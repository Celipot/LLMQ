import type { CareerSong } from '../types';

interface CareerNotebookProps {
  notebook: CareerSong[];
  songInNotebook?: boolean;
}

// The titles found so far, shown next to the stats and next to the round being played,
// where it tells whether the title to guess is one of them.
export default function CareerNotebook({ notebook, songInNotebook = false }: CareerNotebookProps) {
  if (notebook.length === 0) return null;

  return (
    <div className="career-notebook">
      {songInNotebook && <p className="career-notebook-hint">Ce titre est dans ton carnet</p>}
      <h2>{`Carnet (${notebook.length})`}</h2>
      <ul>
        {notebook.map((song) => (
          <li key={song.id}>{song.title}</li>
        ))}
      </ul>
    </div>
  );
}
