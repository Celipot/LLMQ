import { useState } from 'react';
import { createMultiplayerGame } from '../api';

interface HomeProps {
  onSelectRandom: () => void;
  onSelectList: () => void;
}

export default function Home({ onSelectRandom, onSelectList }: HomeProps) {
  const [gameLink, setGameLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateMultiplayer() {
    setError(null);
    setGameLink(null);
    try {
      const { gameId } = await createMultiplayerGame();
      setGameLink(`/game/${gameId}`);
    } catch {
      setError('La création de la partie a échoué. Réessaie.');
    }
  }

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
        <button type="button" className="mode-card" onClick={handleCreateMultiplayer}>
          <span className="mode-card-title">Créer une partie multijoueur</span>
          <span className="mode-card-desc">Génère un lien à partager avec tes amis</span>
        </button>
      </div>
      {gameLink && (
        <p className="multiplayer-link" role="status">
          Partage ce lien : <a href={gameLink}>{gameLink}</a>
        </p>
      )}
      {error && (
        <p className="error-msg" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
