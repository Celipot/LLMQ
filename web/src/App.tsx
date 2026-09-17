import { useState } from 'react';
import ShinyText from './components/ShinyText';
import Player from './components/Player';
import Pips from './components/Pips';
import SearchAutocomplete from './components/SearchAutocomplete';
import History from './components/History';
import Result from './components/Result';
import { useGameState } from './hooks/useGameState';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import './App.css';

export default function App() {
  const { state, titles, error, guess, skip, reset, clearError } = useGameState();
  const [inputValue, setInputValue] = useState('');

  const allowedSeconds = state?.allowedSeconds ?? 1;
  const { audioRef, progress, playError, play, handleEnded, resetProgress } = useAudioPlayer(allowedSeconds);

  if (!state) {
    return null;
  }

  const finished = state.status !== 'playing';

  async function handleSubmit() {
    await guess(inputValue);
    setInputValue('');
  }

  async function handleReset() {
    await reset();
    setInputValue('');
    resetProgress();
  }

  return (
    <main className="app">
      <h1>
        <ShinyText text="LLMQ" speed={3} />
      </h1>
      <p className="subtitle">Devine le titre à partir de l'intro</p>

      <Player
        audioRef={audioRef}
        allowedSeconds={allowedSeconds}
        progress={progress}
        disabled={false}
        onPlay={play}
        onEnded={handleEnded}
      />

      <Pips maxAttempts={state.maxAttempts} guesses={state.guesses} />

      <section className="search-section">
        <SearchAutocomplete
          titles={titles}
          value={inputValue}
          disabled={finished}
          onChange={(v) => {
            setInputValue(v);
            clearError();
          }}
          onSubmit={handleSubmit}
        />
        <div className="actions">
          <button type="button" id="guess-btn" disabled={finished} onClick={handleSubmit}>
            Valider
          </button>
          <button type="button" className="secondary" disabled={finished} onClick={skip}>
            Passer
          </button>
        </div>
        <p className="error-msg" role="alert">
          {error || playError}
        </p>
      </section>

      <History guesses={state.guesses} />

      {finished && <Result state={state} onReset={handleReset} />}
    </main>
  );
}
