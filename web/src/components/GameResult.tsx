import type { GameEndedPlayer, GameEndedSong } from '../types';

interface GameResultProps {
  song: GameEndedSong;
  players: GameEndedPlayer[];
}

interface RankedPlayer extends GameEndedPlayer {
  rank: number;
}

// Standard competition ranking: tied scores share a rank, and the next
// distinct score's rank accounts for how many players are ahead of it
// (1, 1, 3) — so no pair of equal scores is ever shown in an arbitrary order.
function rankPlayers(players: GameEndedPlayer[]): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const ranked: RankedPlayer[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach((player, index) => {
    if (player.score !== lastScore) {
      lastRank = index + 1;
      lastScore = player.score;
    }
    ranked.push({ ...player, rank: lastRank });
  });
  return ranked;
}

export default function GameResult({ song, players }: GameResultProps) {
  const ranked = rankPlayers(players);

  return (
    <section className="result">
      <h2>Partie terminée</h2>
      {song.coverUrl && <img className="result-cover" src={song.coverUrl} alt={song.title} />}
      <p>
        La chanson était : {song.title} — {song.artist}
      </p>
      <ol className="game-result-ranking">
        {ranked.map((player) => (
          <li key={player.playerId}>
            #{player.rank} {player.nickname} — {player.score} pt{player.score > 1 ? 's' : ''}
          </li>
        ))}
      </ol>
    </section>
  );
}
