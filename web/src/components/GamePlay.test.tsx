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
        maxStage={6}
        durationSeconds={4}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={2}
        songCount={5}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(screen.getByText(/Musique 2\/5/)).toBeInTheDocument();
  });

  test('points the audio element at the game-scoped multiplayer track once play is clicked', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={onSubmitAnswer}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: true }}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
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

  test('shows a "stage skipped" message and locks the input on a wrong answer', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: false }}
        forfeited={true}
        onForfeit={vi.fn()}
        songHistory={[]}
        answerPending={false}
        forfeitPending={false}
        players={[]}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("Ce n'est pas ça, étape passée");
    expect(screen.queryByText('Tu as abandonné cette étape.')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  test('labels a player who guessed wrong as "s\'est trompé" in the status list', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
        answerPending={false}
        forfeitPending={false}
        players={[
          { playerId: 'p1', nickname: 'Alice', status: 'forfeited', forfeitReason: 'wrong' },
          { playerId: 'p2', nickname: 'Bob', status: 'forfeited', forfeitReason: 'timeout' },
        ]}
      />
    );

    expect(screen.getByText(/Alice — s'est trompé/)).toBeInTheDocument();
    expect(screen.getByText(/Bob — a abandonné/)).toBeInTheDocument();
  });

  test('clicking "Abandonner cette étape" calls onForfeit', async () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    const onForfeit = vi.fn();
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={onForfeit}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={true}
        onForfeit={vi.fn()}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        songHistory={[]}
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

  test('shows a countdown that ticks down from the answer window', () => {
    vi.useFakeTimers();
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={initialStartedAt}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={12000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={true}
        forfeitPending={false}
        players={[]}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={true}
        players={[]}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={{ correct: true }}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={2}
        songCount={3}
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
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={3}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[{ playerId: 'p1', nickname: 'Alice', status: 'active' }]}
        songHistory={[]}
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
        maxStage={6}
        durationSeconds={4}
        nextDurationSeconds={7}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        songHistory={[]}
      />
    );

    expect(screen.getByText(/Étape 3/).closest('p')).toHaveTextContent('Étape 3 sur 64s');
    expect(screen.getByText('(étape suivante — 7s)')).toBeInTheDocument();
  });

  test('does not show a next stage duration at the last stage', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={6}
        maxStage={6}
        durationSeconds={16}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        songHistory={[]}
      />
    );

    expect(screen.getByText(/Étape 6/).closest('p')).toHaveTextContent('Étape 6 sur 616s');
    expect(screen.queryByText(/^\(\d+s/)).not.toBeInTheDocument();
  });

  test('shows a score recap in the sidebar with each player\'s live status and score, in join order', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={2}
        songCount={3}
        scores={{ p1: 6, p2: 16 }}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[
          { playerId: 'p1', nickname: 'Alice', status: 'found' },
          { playerId: 'p2', nickname: 'Bob', status: 'active' },
        ]}
        songHistory={[]}
      />
    );

    const recap = screen.getByText('Scores').closest('aside');
    const items = recap ? Array.from(recap.querySelectorAll('li')).map((li) => li.textContent) : [];
    expect(items).toEqual(['Alice — a trouvé — 6 pts', 'Bob — cherche encore — 16 pts']);
  });

  test('shows the score recap from the very start of play, before any song has finished', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={null}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[{ playerId: 'p1', nickname: 'Alice', status: 'active' }]}
        songHistory={[]}
      />
    );

    const recap = screen.getByText('Scores').closest('aside');
    expect(recap).toHaveTextContent('Alice — cherche encore');
  });

  test('shows the song history on the right once a song has ended', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={2}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={2}
        songCount={2}
        scores={{ p1: 12, p2: 0 }}
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
        songHistory={[{ title: 'Some Song', artist: 'Some Artist', coverUrl: '/covers/x.png' }]}
      />
    );

    const history = screen.getByText('Historique').closest('aside');
    expect(history).toHaveTextContent('Some Song');
    expect(history).toHaveTextContent('Some Artist');
    expect(history?.querySelector('img')).toHaveAttribute('src', '/covers/x.png');
  });

  test('accumulates every finished song in the history, oldest first', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={2}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={3}
        songCount={3}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[]}
        songHistory={[
          { title: 'First Song', artist: 'Artist A', coverUrl: '/covers/a.png' },
          { title: 'Second Song', artist: 'Artist B', coverUrl: '/covers/b.png' },
        ]}
      />
    );

    const history = screen.getByText('Historique').closest('aside');
    const titles = history ? Array.from(history.querySelectorAll('li')).map((li) => li.textContent) : [];
    expect(titles).toEqual(['First SongArtist A', 'Second SongArtist B']);
  });

  test('does not show the song history while no song has ended yet', () => {
    vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
    render(
      <GamePlay
        gameId="g1"
        stage={1}
        maxStage={6}
        durationSeconds={1}
        nextDurationSeconds={2}
        answerWindowMs={30000}
        startedAt={Date.now()}
        songIndex={1}
        songCount={1}
        scores={{}}
        onSubmitAnswer={vi.fn()}
        answerFeedback={null}
        forfeited={false}
        onForfeit={vi.fn()}
        answerPending={false}
        forfeitPending={false}
        players={[{ playerId: 'p1', nickname: 'Alice', status: 'active' }]}
        songHistory={[]}
      />
    );

    expect(screen.queryByText('Historique')).not.toBeInTheDocument();
  });
  describe('stage change banner', () => {
    function renderGamePlay(overrides: { stage: number; songIndex: number }) {
      return (
        <GamePlay
          gameId="g1"
          stage={overrides.stage}
          maxStage={6}
          durationSeconds={4}
          nextDurationSeconds={null}
          answerWindowMs={30000}
          startedAt={Date.now()}
          songIndex={overrides.songIndex}
          songCount={5}
          scores={{}}
          onSubmitAnswer={vi.fn()}
          answerFeedback={null}
          forfeited={false}
          onForfeit={vi.fn()}
          answerPending={false}
          forfeitPending={false}
          players={[]}
          songHistory={[]}
        />
      );
    }

    test('flags a new song when the game starts on its first stage', () => {
      vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
      render(renderGamePlay({ stage: 1, songIndex: 1 }));

      expect(screen.getByText('Nouvelle musique')).toBeInTheDocument();
    });

    test('flags a new stage when the stage advances', () => {
      vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
      const { rerender } = render(renderGamePlay({ stage: 2, songIndex: 1 }));

      rerender(renderGamePlay({ stage: 3, songIndex: 1 }));

      expect(screen.getByText('Nouvelle étape')).toBeInTheDocument();
    });

    test('does not flag anything when the game is joined mid-song', () => {
      vi.mocked(api.fetchTitles).mockResolvedValue(TITLES);
      render(renderGamePlay({ stage: 3, songIndex: 2 }));

      expect(screen.queryByText('Nouvelle étape')).not.toBeInTheDocument();
      expect(screen.queryByText('Nouvelle musique')).not.toBeInTheDocument();
    });
  });
});
