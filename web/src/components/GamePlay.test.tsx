import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import GamePlay from './GamePlay';
import * as api from '../api';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    fetchTitles: vi.fn(),
  };
});

const TITLES = [{ id: 1, title: 'Correct Title', artist: 'Some Artist', status: 'not_started' as const }];

describe('GamePlay', () => {
  test('renders the stage number and the bounded duration', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(<GamePlay gameId="g1" stage={2} durationSeconds={4} onSubmitAnswer={vi.fn()} answerFeedback={null} />);

    expect(screen.getByText(/Étape 2/)).toBeInTheDocument();
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });

  test('points the audio element at the game-scoped multiplayer track once play is clicked', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(<GamePlay gameId="g1" stage={1} durationSeconds={1} onSubmitAnswer={vi.fn()} answerFeedback={null} />);

    await userEvent.click(screen.getByRole('button', { name: 'Écouter' }));

    const audio = document.querySelector('audio');
    expect(audio?.src).toContain('/games/g1/audio');
  });

  test('submits the typed title and clears the input', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    const onSubmitAnswer = vi.fn();
    render(<GamePlay gameId="g1" stage={1} durationSeconds={1} onSubmitAnswer={onSubmitAnswer} answerFeedback={null} />);

    const input = await screen.findByRole('textbox');
    await userEvent.type(input, 'Correct Title');
    await userEvent.click(screen.getByText('Valider'));

    expect(onSubmitAnswer).toHaveBeenCalledWith('Correct Title');
    expect(input).toHaveValue('');
  });

  test('shows a success message and disables input once the answer is correct', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: true }}
      />
    );

    expect(await screen.findByText('Bravo, tu as trouvé !')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('Valider')).toBeDisabled();
  });

  test('shows a retry message and keeps input enabled on a wrong answer', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: false }}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce n'est pas ça");
    expect(screen.getByRole('textbox')).toBeEnabled();
  });
});
