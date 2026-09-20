import type { Career } from '../types';

interface CareerObjectiveProps {
  career: Career;
}

interface Objective {
  text: string;
  // Shown one per line instead of the text.
  lines?: string[];
  turnsLeft?: number;
}

// The current turn still counts: at turn 1 there are 10 turns before the album.
function objectiveOf(career: Career): Objective {
  const {
    failure,
    concertResult,
    concertDue,
    release,
    releaseDue,
    albumGoalGrade,
    fans,
    turn,
    releaseAt,
    concertAt,
    finalTurn,
    finaleDue,
    finaleResult,
    finaleGoals,
  } = career;
  const fansProgress = `${fans.current} / ${fans.required}`;
  if (failure === 'ALBUM_GRADE') return { text: `Objectif raté : l'album n'a pas atteint le grade ${albumGoalGrade}` };
  if (failure === 'FANS') {
    return { text: `Objectif raté : pas assez de FSI pour participer au concert (${fansProgress})` };
  }
  if (failure === 'FINALE_GOALS') {
    return { text: "Objectif raté : pas assez de concerts et d'albums réussis pour le SIF" };
  }
  if (finaleResult) return { text: 'Carrière terminée' };
  if (finaleDue) return { text: 'Donner le SIF' };
  if (concertResult) {
    const { concerts, albums } = finaleGoals;
    return {
      text: '',
      lines: [`Concert B+ ${concerts.good} / ${concerts.requiredGood}`, `Album B+ ${albums.good} / ${albums.requiredGood}`],
      turnsLeft: finalTurn - turn + 1,
    };
  }
  if (concertDue) return { text: 'Donner le concert' };
  if (release) {
    return {
      text: `Atteindre ${fans.required} FSI pour participer au concert (${fansProgress})`,
      turnsLeft: concertAt - turn + 1,
    };
  }
  const text = `Sortir l'album avec un grade ${albumGoalGrade} ou mieux`;
  return releaseDue ? { text } : { text, turnsLeft: releaseAt - turn + 1 };
}

export default function CareerObjective({ career }: CareerObjectiveProps) {
  const { text, lines, turnsLeft } = objectiveOf(career);
  const deadline =
    turnsLeft !== undefined ? (
      <span className="career-objective-deadline">{` (dans ${turnsLeft} ${turnsLeft > 1 ? 'tours' : 'tour'})`}</span>
    ) : null;
  return (
    <section className="career-objective" aria-label="Objectif en cours">
      <p className="career-objective-title">Objectif en cours</p>
      <p className="career-objective-text">
        {lines ? (
          lines.map((line, index) => (
            <span key={line} className="career-objective-line">
              {line}
              {index === lines.length - 1 && deadline}
            </span>
          ))
        ) : (
          <>
            {text}
            {deadline}
          </>
        )}
      </p>
    </section>
  );
}
