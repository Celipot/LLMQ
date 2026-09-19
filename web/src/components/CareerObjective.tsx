import type { Career } from '../types';

interface CareerObjectiveProps {
  career: Career;
}

interface Objective {
  text: string;
  turnsLeft?: number;
}

// The current turn still counts: at turn 1 there are 10 turns before the album.
function objectiveOf(career: Career): Objective {
  const { failure, concertResult, concertDue, release, releaseDue, albumGoalGrade, fans, turn, releaseAt, totalTurns } =
    career;
  const fansProgress = `${fans.current} / ${fans.required}`;
  if (failure === 'ALBUM_GRADE') return { text: `Objectif raté : l'album n'a pas atteint le grade ${albumGoalGrade}` };
  if (failure === 'FANS') {
    return { text: `Objectif raté : pas assez de FSI pour participer au concert (${fansProgress})` };
  }
  if (concertResult) return { text: 'Carrière terminée' };
  if (concertDue) return { text: 'Donner le concert' };
  if (release) {
    return {
      text: `Atteindre ${fans.required} FSI pour participer au concert (${fansProgress})`,
      turnsLeft: totalTurns - turn + 1,
    };
  }
  const text = `Sortir l'album avec un grade ${albumGoalGrade} ou mieux`;
  return releaseDue ? { text } : { text, turnsLeft: releaseAt - turn + 1 };
}

export default function CareerObjective({ career }: CareerObjectiveProps) {
  const { text, turnsLeft } = objectiveOf(career);
  return (
    <section className="career-objective" aria-label="Objectif en cours">
      <p className="career-objective-title">Objectif en cours</p>
      <p className="career-objective-text">
        {text}
        {turnsLeft !== undefined && (
          <span className="career-objective-deadline">{` (dans ${turnsLeft} ${turnsLeft > 1 ? 'tours' : 'tour'})`}</span>
        )}
      </p>
    </section>
  );
}
