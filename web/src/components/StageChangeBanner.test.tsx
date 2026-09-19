import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import StageChangeBanner from './StageChangeBanner';

describe('StageChangeBanner', () => {
  test('announces a new song with its position out of the total', () => {
    render(
      <StageChangeBanner
        notice={{ kind: 'song', songIndex: 3, songCount: 10, stage: 1, maxStage: 6, durationSeconds: 1 }}
      />
    );

    expect(screen.getByText('Nouvelle musique')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  test('announces a new stage with its position and listening time', () => {
    render(
      <StageChangeBanner
        notice={{ kind: 'stage', songIndex: 3, songCount: 10, stage: 4, maxStage: 6, durationSeconds: 8 }}
      />
    );

    expect(screen.getByText('Nouvelle étape')).toBeInTheDocument();
    expect(screen.getByText("4/6 · 8 s d'écoute")).toBeInTheDocument();
  });

  test('keeps its live region mounted without a notice so screen readers pick up the next one', () => {
    const { container } = render(<StageChangeBanner notice={null} />);

    expect(container.querySelector('[aria-live="polite"]')).toBeEmptyDOMElement();
  });
});
