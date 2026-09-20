import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import StatBars from './StatBars';

const stats = { oreille: 100, memoire: 0, culture: 0 };
const statMax = { oreille: 300, memoire: 300, culture: 200 };

function statItem(label: string) {
  return screen.getByText(label).closest('li') as HTMLElement;
}

describe('StatBars', () => {
  test('shows no tooltip until a stat is hovered or focused', () => {
    render(<StatBars stats={stats} statMax={statMax} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('hovering a stat lists what its steps unlock', async () => {
    render(<StatBars stats={stats} statMax={statMax} />);

    await userEvent.hover(statItem('Oreille'));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent("+0,5 s à l'intro du 1er essai");
    expect(tooltip).toHaveTextContent("+0,5 s à l'intro du 3e essai");
  });

  test('leaving the stat hides the tooltip', async () => {
    render(<StatBars stats={stats} statMax={statMax} />);
    await userEvent.hover(statItem('Oreille'));

    await userEvent.unhover(statItem('Oreille'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('focusing a stat with the keyboard shows its tooltip too', async () => {
    render(<StatBars stats={stats} statMax={statMax} />);

    await userEvent.tab();

    expect(screen.getByRole('tooltip')).toHaveTextContent('1er essai');
  });

  test('only the hovered stat has a tooltip, described by aria-describedby', async () => {
    render(<StatBars stats={stats} statMax={statMax} />);

    await userEvent.hover(statItem('Mémoire'));

    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 suggestions de recherche');
    expect(statItem('Mémoire')).toHaveAccessibleDescription(/2 suggestions de recherche/);
  });

  test('marks the steps already reached and shows the value still to reach', async () => {
    render(<StatBars stats={stats} statMax={statMax} />);

    await userEvent.hover(statItem('Oreille'));

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent("✓ 100 : +0,5 s à l'intro du 1er essai");
    expect(tooltip).toHaveTextContent("· 200 : +0,5 s à l'intro du 2e essai");
  });
});

describe('StatBars beyond the maximum', () => {
  function fillOf(label: string) {
    return statItem(label).querySelector('.stat-bar-fill') as HTMLElement;
  }

  test('a stat that reached its maximum is shown full, even when it keeps growing', () => {
    render(<StatBars stats={{ oreille: 340, memoire: 0, culture: 200 }} statMax={statMax} />);

    expect(fillOf('Oreille')).toHaveStyle({ width: '100%' });
    expect(fillOf('Culture')).toHaveStyle({ width: '100%' });
    expect(statItem('Oreille')).toHaveTextContent('340');
  });

  test('a stat under its maximum still fills toward the next step', () => {
    render(<StatBars stats={{ oreille: 250, memoire: 0, culture: 0 }} statMax={statMax} />);

    expect(fillOf('Oreille')).toHaveStyle({ width: '50%' });
  });

  test('a negative stat is shown empty with its value', () => {
    render(<StatBars stats={{ oreille: -100, memoire: 0, culture: 0 }} statMax={statMax} />);

    expect(fillOf('Oreille')).toHaveStyle({ width: '0%' });
    expect(statItem('Oreille')).toHaveTextContent('-100');
  });
});
