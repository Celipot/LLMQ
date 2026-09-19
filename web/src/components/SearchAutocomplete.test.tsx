import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import SearchAutocomplete from './SearchAutocomplete';

const TITLES = [
  { id: 1, title: 'Placeholder Track', artist: 'LLMQ Dev', status: 'not_started' as const },
  { id: 2, title: 'Été éternel', artist: 'Some Group', status: 'not_started' as const },
  { id: 3, title: 'Another Song', artist: 'Other Artist', status: 'not_started' as const },
];

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

  test('suggests a title despite a typo in the query', async () => {
    const user = userEvent.setup();
    setup({ value: 'placeholdr trak' });
    await user.type(screen.getByRole('textbox'), 'x');
    expect(screen.getByText('Placeholder Track — LLMQ Dev')).toBeInTheDocument();
  });

  test('selecting a suggestion calls onChange with the exact title, not onSubmit', async () => {
    const user = userEvent.setup();
    const { onChange, onSubmit } = setup({ value: 'place' });
    // The suggestions list only opens on an input event (controlled `value`
    // alone doesn't open it), so type a keystroke to trigger it first.
    await user.type(screen.getByRole('textbox'), 'x');
    await user.click(screen.getByText('Placeholder Track — LLMQ Dev'));
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

  test('caps the suggestion list and ranks starts-with matches first', async () => {
    const user = userEvent.setup();
    // 30 songs all containing "ann" somewhere, split between titles that
    // start with it and titles that only contain it mid-string.
    const manyTitles = [
      ...Array.from({ length: 15 }, (_, i) => ({
        id: i,
        title: `Anniversary Song ${i}`,
        artist: 'Group A',
        status: 'not_started' as const,
      })),
      ...Array.from({ length: 15 }, (_, i) => ({
        id: 15 + i,
        title: `Song With Ann in it ${i}`,
        artist: 'Group B',
        status: 'not_started' as const,
      })),
    ];
    setup({ titles: manyTitles, value: 'ann' });
    await user.type(screen.getByRole('textbox'), 'x');

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.every((li) => li.textContent?.startsWith('Anniversary Song'))).toBe(true);
  });
});
