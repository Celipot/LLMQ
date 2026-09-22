import type { CareerSong, TitleHint } from '../types';

interface CareerNotebookProps {
  notebook: CareerSong[];
  songInNotebook?: boolean;
  hint?: TitleHint;
}

// The titles found so far, shown next to the stats and next to the round being played,
// where it tells whether the title to guess is one of them and, on the normal difficulty,
// what kind of title it is.
export default function CareerNotebook({ notebook, songInNotebook = false, hint }: CareerNotebookProps) {
  if (notebook.length === 0 && !hint) return null;

  return (
    <div className="career-notebook">
      {hint && <p className="career-title-hint">{hint.singer ? `${hint.group} : ${hint.singer}` : hint.group}</p>}
      {songInNotebook && <p className="career-notebook-hint">Ce titre est dans ton carnet</p>}
      {notebook.length > 0 && (
        <>
          <h2>{`Carnet (${notebook.length})`}</h2>
          <ul>
            {notebook.map((song) => (
              <li key={song.id}>{song.title}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
