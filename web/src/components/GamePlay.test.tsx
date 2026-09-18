import { act, render, screen } from '@testing-library/react';
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
    render(
      <GamePlay
        gameId="g1"
        stage={2}
        durationSeconds={4}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(screen.getByText(/Étape 2/)).toBeInTheDocument();
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });

  test('renders the current song index out of the total song count', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={2}
        songCount={5}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(screen.getByText(/Musique 2\/5/)).toBeInTheDocument();
  });

  test('shows a reveal banner for the previous song when songReveal is set', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={2}
        songCount={5}
        songReveal={{
          song: { title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' },
          players: [{ playerId: 'p1', nickname: 'Alice', foundStage: 1, score: 6 }],
        }}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(screen.getByText(/Some Song — Some Artist/)).toBeInTheDocument();
  });

  test('points the audio element at the game-scoped multiplayer track once play is clicked', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Écouter' }));

    const audio = document.querySelector('audio');
    expect(audio?.src).toContain('/games/g1/audio');
  });

  test('submits the typed title and clears the input', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    const onSubmitAnswer = vi.fn();
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={onSubmitAnswer}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

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
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: true }}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(await screen.findByText('Bravo, tu as trouvé !')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('Valider')).toBeDisabled();
    expect(screen.getByText('Abandonner cette étape')).toBeDisabled();
  });

  test('shows a retry message and keeps input enabled on a wrong answer', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: false }}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce n'est pas ça");
    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  test('clicking "Abandonner cette étape" calls onForfeit', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    const onForfeit = vi.fn();
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={onForfeit}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    await userEvent.click(screen.getByText('Abandonner cette étape'));

    expect(onForfeit).toHaveBeenCalledOnce();
  });

  test('shows the forfeited message and disables guessing once forfeited', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={true}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(await screen.findByText('Tu as abandonné cette étape.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('Valider')).toBeDisabled();
    expect(screen.getByText('Abandonner cette étape')).toBeDisabled();
  });

  test('renders each player with their current status', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[
          { playerId: 'p1', nickname: 'Alice', status: 'active' },
          { playerId: 'p2', nickname: 'Bob', status: 'found' },
          { playerId: 'p3', nickname: 'Chris', status: 'forfeited' },
        ]}
      />
    );

    expect(screen.getByText('Alice — cherche encore')).toBeInTheDocument();
    expect(screen.getByText('Bob — a trouvé')).toBeInTheDocument();
    expect(screen.getByText('Chris — a abandonné')).toBeInTheDocument();
  });

  test('does not reveal the answer or song name in the player status list', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[{ playerId: 'p1', nickname: 'Alice', status: 'found' }]}
      />
    );

    expect(screen.queryByText(TITLES[0].title)).not.toBeInTheDocument();
  });

  test('shows a disconnected indicator distinct from the status for a dropped player', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        onLeave={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[
          { playerId: 'p1', nickname: 'Alice', status: 'active', connected: false },
          { playerId: 'p2', nickname: 'Bob', status: 'active', connected: true },
        ]}
      />
    );

    expect(screen.getByText(/Alice — cherche encore/)).toHaveTextContent('(déconnecté)');
    expect(screen.getByText(/Bob — cherche encore/)).not.toHaveTextContent('(déconnecté)');
  });

  test('clicking "Quitter la partie" calls onLeave', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    const onLeave = vi.fn();
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        onLeave={onLeave}
      />
    );

    await userEvent.click(screen.getByText('Quitter la partie'));

    expect(onLeave).toHaveBeenCalledOnce();
  });

  test('shows a countdown that ticks down from the answer window', () => {
    vi.useFakeTimers();
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 30s');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 25s');

    vi.useRealTimers();
  });

  test('restarts the countdown when startedAt changes (e.g. a reconnect resync)', () => {
    vi.useFakeTimers();
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    const initialStartedAt = Date.now();
    const { rerender } = render(
      <GamePlay
        gameId="g1"
        stage={3}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={initialStartedAt}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        onLeave={vi.fn()}
      />
    );
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 10s');

    // A resync arrives mid-stage with 12s left, reported at a fresh startedAt.
    rerender(
      <GamePlay
        gameId="g1"
        stage={3}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={12000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByRole('timer')).toHaveTextContent('Temps restant : 12s');

    vi.useRealTimers();
  });

  test('shows a pending indicator and disables controls while an answer submission is in flight', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={true}
        forfeitPending={false}
        players={[]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('En attente du serveur…');
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByText('Valider…')).toBeDisabled();
    expect(screen.getByText('Abandonner cette étape')).toBeDisabled();
  });

  test('shows a pending indicator and disables controls while a forfeit is in flight', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={true}
        players={[]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('En attente du serveur…');
    expect(screen.getByText('Valider')).toBeDisabled();
    expect(screen.getByText('Abandonner…')).toBeDisabled();
  });

  test('does not show a pending indicator once found (even if buttons are already disabled)', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: true }}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.queryByText('En attente du serveur…')).not.toBeInTheDocument();
  });

  test('shows each player\'s running score once at least one song has finished', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={2}
        songCount={3}
        songReveal={null}
        scores={{ p1: 16, p2: 0 }}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[
          { playerId: 'p1', nickname: 'Alice', status: 'active' },
          { playerId: 'p2', nickname: 'Bob', status: 'active' },
        ]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText(/Alice — cherche encore/)).toHaveTextContent('16 pts');
    expect(screen.getByText(/Bob — cherche encore/)).toHaveTextContent('0 pt');
  });

  test('does not show a score for a player who has not finished a song yet', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={3}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[{ playerId: 'p1', nickname: 'Alice', status: 'active' }]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText('Alice — cherche encore')).toBeInTheDocument();
    expect(screen.queryByText(/pt/)).not.toBeInTheDocument();
  });

  test('shows the current stage duration next to the stage number and the next stage duration below', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={3}
        durationSeconds={4}
        nextDurationSeconds={7}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText(/Étape 3/).closest('p')).toHaveTextContent('Étape 34s');
    expect(screen.getByText('(7s — étape suivante)')).toBeInTheDocument();
  });

  test('does not show a next stage duration at the last stage', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={6}
        durationSeconds={16}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        songReveal={null}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText(/Étape 6/).closest('p')).toHaveTextContent('Étape 616s');
    expect(screen.queryByText(/^\(\d+s/)).not.toBeInTheDocument();
  });
});
