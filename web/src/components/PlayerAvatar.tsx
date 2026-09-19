interface PlayerAvatarProps {
  nickname: string;
  avatarUrl?: string;
}

// Decorative: the nickname is always written next to it. The fallback initial
// comes from CSS (data-initial) so it adds no text to the surrounding line.
export default function PlayerAvatar({ nickname, avatarUrl }: PlayerAvatarProps) {
  if (avatarUrl) {
    return <img className="player-avatar" src={avatarUrl} alt="" />;
  }
  return (
    <span
      className="player-avatar player-avatar-fallback"
      data-initial={nickname.trim().charAt(0).toUpperCase()}
      aria-hidden="true"
    />
  );
}
