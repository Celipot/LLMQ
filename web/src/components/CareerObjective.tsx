import type { Career } from '../types';

interface CareerObjectiveProps {
  career: Career;
}

function objectiveText({ failure, concertResult, concertDue, release, albumGoalGrade, fans }: Career): string {
  const fansProgress = `${fans.current} / ${fans.required}`;
  if (failure === 'ALBUM_GRADE') return `Objectif raté : l'album n'a pas atteint le grade ${albumGoalGrade}`;
  if (failure === 'FANS') return `Objectif raté : pas assez de FSI pour participer au concert (${fansProgress})`;
  if (concertResult) return 'Carrière terminée';
  if (concertDue) return 'Donner le concert';
  if (release) return `Atteindre ${fans.required} FSI pour participer au concert (${fansProgress})`;
  return `Sortir l'album avec un grade ${albumGoalGrade} ou mieux`;
}

export default function CareerObjective({ career }: CareerObjectiveProps) {
  return (
    <section className="career-objective" aria-label="Objectif en cours">
      <p className="career-objective-title">Objectif en cours</p>
      <p className="career-objective-text">{objectiveText(career)}</p>
    </section>
  );
}
