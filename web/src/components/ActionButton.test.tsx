import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import ActionButton from './ActionButton';

function renderButton(props: Partial<Parameters<typeof ActionButton>[0]> = {}) {
  const onClick = vi.fn();
  render(
    <>
      <ActionButton tooltip="Rend toute l'énergie" onClick={onClick} {...props}>
        Repos
      </ActionButton>
      <button type="button">Ailleurs</button>
    </>,
  );
  return { onClick };
}

describe('ActionButton', () => {
  test('shows no tooltip until the button is hovered', () => {
    renderButton();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('hovering the button shows its tooltip, and leaving hides it', async () => {
    renderButton();

    await userEvent.hover(screen.getByRole('button', { name: 'Repos' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent("Rend toute l'énergie");

    await userEvent.unhover(screen.getByRole('button', { name: 'Repos' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('focusing the button with the keyboard shows the tooltip too, described by aria-describedby', async () => {
    renderButton();

    await userEvent.tab();

    expect(screen.getByRole('tooltip')).toHaveTextContent("Rend toute l'énergie");
    expect(screen.getByRole('button', { name: 'Repos' })).toHaveAccessibleDescription("Rend toute l'énergie");
  });

  test('leaving the focus hides the tooltip', async () => {
    renderButton();
    await userEvent.tab();

    await userEvent.tab();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('a disabled button still explains itself when its box is hovered', async () => {
    renderButton({ disabled: true });

    await userEvent.hover(screen.getByRole('button', { name: 'Repos' }).parentElement as HTMLElement);

    expect(screen.getByRole('tooltip')).toHaveTextContent("Rend toute l'énergie");
  });

  test('clicking calls onClick', async () => {
    const enabled = renderButton();
    await userEvent.click(screen.getByRole('button', { name: 'Repos' }));
    expect(enabled.onClick).toHaveBeenCalledOnce();
  });
});
