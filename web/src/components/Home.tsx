interface HomeProps {
  onSelectRandom: () => void;
  onSelectList: () => void;
}

export default function Home({ onSelectRandom, onSelectList }: HomeProps) {
  return (
    <section className="home">
      <p className="subtitle">Choisis un mode pour commencer</p>
      <div className="mode-choice">
        <button type="button" className="mode-card" onClick={onSelectRandom}>
          <span className="mode-card-title">Mode Aléatoire</span>
          <span className="mode-card-desc">Devine une chanson piochée au hasard</span>
        </button>
        <button type="button" className="mode-card" onClick={onSelectList}>
          <span className="mode-card-title">Mode Liste</span>
          <span className="mode-card-desc">Choisis toi-même la chanson à deviner</span>
        </button>
      </div>
    </section>
  );
}
