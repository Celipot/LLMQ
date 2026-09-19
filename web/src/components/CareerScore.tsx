import type { CareerScore as CareerScoreData } from '../types';

interface CareerScoreProps {
  score: CareerScoreData;
}

export default function CareerScore({ score }: CareerScoreProps) {
  return (
    <section className="career-score" aria-label="Score de carrière">
      <p className="career-score-title">Score de carrière</p>
      <p className="career-score-total">{score.total}</p>
      <ul className="career-score-parts">
        <li>{`Album : ${score.album}`}</li>
        <li>{`Concert : ${score.concert}`}</li>
        <li>{`Stats : ${score.stats}`}</li>
        <li>{`Fans : ${score.fans}`}</li>
      </ul>
    </section>
  );
}
