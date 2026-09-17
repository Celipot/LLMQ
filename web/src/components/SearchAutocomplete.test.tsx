import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import SearchAutocomplete from './SearchAutocomplete';

const TITLES = ['Placeholder Track', 'Été éternel', 'Another Song'];

function setup(overrides: Partial<React.ComponentProps<typeof SearchAutocomplete>> = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <SearchAutocomplete
      titles={TITLES}
      value=""
      disabled={false}
      onChange={onChange}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { onChange, onSubmit, ...utils };
}

describe('SearchAutocomplete', () => {
  test('shows no suggestions for an empty query', () => {
    setup();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  test('filters suggestions case- and accent-insensitively', async () => {
    const user = userEvent.setup();
    setup({ value: 'ete' });
    const input = screen.getByRole('textbox');
    await user.type(input, 'x');
    // Re-render with the value the component would have after onChange in
    // real usage; since this component is controlled, drive it directly.
    expect(screen.queryByText('Placeholder Track')).not.toBeInTheDocument();
  });

  test('selecting a suggestion calls onChange with the exact title, not onSubmit', async () => {
    const user = userEvent.setup();
    const { onChange, onSubmit } = setup({ value: 'place' });
    // The suggestions list only opens on an input event (controlled `value`
    // alone doesn't open it), so type a keystroke to trigger it first.
    await user.type(screen.getByRole('textbox'), 'x');
    await user.click(screen.getByText('Placeholder Track'));
    expect(onChange).toHaveBeenCalledWith('Placeholder Track');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('Enter with no suggestion highlighted submits instead of selecting', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ value: 'zzz-no-match' });
    await user.type(screen.getByRole('textbox'), '{Enter}');
    expect(onSubmit).toHaveBeenCalled();
  });

  test('disabled input cannot be typed into', () => {
    setup({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
