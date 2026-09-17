import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import SongList from './SongList';
import type { PlayableSong } from '../types';

const titles: PlayableSong[] = [
  { id: 1, title: 'Not Started Song', artist: 'Artist A', status: 'not_started' },
  { id: 2, title: 'In Progress Song', artist: 'Artist B', status: 'playing' },
  { id: 3, title: 'Finished Song', artist: 'Artist C', status: 'won' },
];

describe('SongList', () => {
  test('renders every song with its title and artist', () => {
    render(<SongList titles={titles} activeSongId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('Not Started Song')).toBeInTheDocument();
    expect(screen.getByText('In Progress Song')).toBeInTheDocument();
    expect(screen.getByText('Finished Song')).toBeInTheDocument();
  });

  test('shows a badge for in-progress and finished songs, none for not-started', () => {
    render(<SongList titles={titles} activeSongId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('en cours')).toBeInTheDocument();
    expect(screen.getByText('terminé')).toBeInTheDocument();
  });

  test('marks the active song distinctly', () => {
    render(<SongList titles={titles} activeSongId={2} onSelect={vi.fn()} />);
    expect(screen.getByText('In Progress Song').closest('button')).toHaveClass('active');
    expect(screen.getByText('Not Started Song').closest('button')).not.toHaveClass('active');
  });

  test('calls onSelect with the clicked song id', async () => {
    const onSelect = vi.fn();
    render(<SongList titles={titles} activeSongId={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByText('Finished Song'));

    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
