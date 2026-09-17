import type { PlayableSong } from '../types';

interface SongListProps {
  titles: PlayableSong[];
  activeSongId: number | null;
  onSelect: (id: number) => void;
}

const STATUS_LABEL: Record<PlayableSong['status'], string | null> = {
  not_started: null,
  playing: 'en cours',
  won: 'terminé',
  lost: 'terminé',
};

export default function SongList({ titles, activeSongId, onSelect }: SongListProps) {
  return (
    <nav className="song-list" aria-label="Liste des chansons">
      <ul>
        {titles.map((song) => {
          const label = STATUS_LABEL[song.status];
          return (
            <li key={song.id}>
              <button
                type="button"
                className={`song-list-item ${song.id === activeSongId ? 'active' : ''}`}
                onClick={() => onSelect(song.id)}
              >
                <span className="song-list-title">{song.title}</span>
                <span className="song-list-artist">{song.artist}</span>
                {label && <span className={`song-list-badge ${song.status}`}>{label}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
