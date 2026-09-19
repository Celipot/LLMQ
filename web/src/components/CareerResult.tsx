import type { CareerResult as CareerResultData } from '../types';

interface CareerResultProps {
  label: string;
  result: CareerResultData;
}

// Only the grade is always visible; the score and tracklist unfold on demand.
export default function CareerResult({ label, result }: CareerResultProps) {
  return (
    <details className="career-result">
      <summary>
        <span>{label}</span>
        <span className="career-rank">{`Grade ${result.grade}`}</span>
      </summary>
      <p>{`Score ${result.score} / ${result.maxScore}`}</p>
      <ol className="album-tracks">
        {result.tracks.map(({ song, rank, points }) => (
          <li key={song.id} className="album-track">
            <img className="album-track-cover" src={song.coverUrl} alt="" />
            <span className="album-track-title">{song.title}</span>
            <span className="album-track-score">
              <span>{rank === 'FAIL' ? 'Raté' : `Rang ${rank}`}</span>
              <span>{`${points} ${points > 1 ? 'pts' : 'pt'}`}</span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
