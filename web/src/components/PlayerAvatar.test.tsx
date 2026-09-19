import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import PlayerAvatar from './PlayerAvatar';

describe('PlayerAvatar', () => {
  test('shows the picture when the player has one', () => {
    const { container } = render(<PlayerAvatar nickname="Alice" avatarUrl="/games/g1/players/p1/avatar" />);

    expect(container.querySelector('img')).toHaveAttribute('src', '/games/g1/players/p1/avatar');
  });

  test('is decorative: the nickname is already written next to it', () => {
    const { container } = render(<PlayerAvatar nickname="Alice" avatarUrl="/a.png" />);

    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  test('falls back to the capitalised initial without a picture', () => {
    const { container } = render(<PlayerAvatar nickname="alice" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.player-avatar-fallback')).toHaveAttribute('data-initial', 'A');
  });

  test('adds no text to the surrounding line', () => {
    const { container } = render(<PlayerAvatar nickname="Alice" />);

    expect(container).toHaveTextContent('');
  });
});
