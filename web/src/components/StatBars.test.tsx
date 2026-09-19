import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import StatBars from './StatBars';

const stats = { oreille: 100, memoire: 0, culture: 0 };

function statItem(label: string) {
  return screen.getByText(label).closest('li') as HTMLElement;
}

describe('StatBars', () => {
  test('shows no tooltip until a stat is hovered or focused', () => {
    render(<StatBars stats={stats} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('hovering a stat lists what its steps unlock', async () => {
    render(<StatBars stats={stats} />);

    await userEvent.hover(statItem('Oreille'));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent("+0,5 s à l'intro du 1er essai");
    expect(tooltip).toHaveTextContent("+0,5 s à l'intro du 3e essai");
  });

  test('leaving the stat hides the tooltip', async () => {
    render(<StatBars stats={stats} />);
    await userEvent.hover(statItem('Oreille'));

    await userEvent.unhover(statItem('Oreille'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('focusing a stat with the keyboard shows its tooltip too', async () => {
    render(<StatBars stats={stats} />);

    await userEvent.tab();

    expect(screen.getByRole('tooltip')).toHaveTextContent('1er essai');
  });

  test('only the hovered stat has a tooltip, described by aria-describedby', async () => {
    render(<StatBars stats={stats} />);

    await userEvent.hover(statItem('Mémoire'));

    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 suggestions de recherche');
    expect(statItem('Mémoire')).toHaveAccessibleDescription(/2 suggestions de recherche/);
  });

  test('marks the steps already reached and shows the value still to reach', async () => {
    render(<StatBars stats={stats} />);

    await userEvent.hover(statItem('Oreille'));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent("✓ 100 : +0,5 s à l'intro du 1er essai");
    expect(tooltip).toHaveTextContent("· 200 : +0,5 s à l'intro du 2e essai");
  });
});
