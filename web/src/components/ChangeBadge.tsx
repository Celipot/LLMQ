interface ChangeBadgeProps {
  label: string;
  amount: number;
}

// A card with an arrow pointing at the field it sits next to; the sign, not only the
// colour, tells a gain from a loss.
export default function ChangeBadge({ label, amount }: ChangeBadgeProps) {
  const text = `${amount > 0 ? '+' : '−'}${Math.abs(amount)}`;
  return (
    <span role="status" aria-label={`${label} ${text}`} className={`change-badge ${amount > 0 ? 'gain' : 'loss'}`}>
      {text}
    </span>
  );
}
