import { useState } from 'react';
import ShinyText from './components/ShinyText';
import Player from './components/Player';
import Pips from './components/Pips';
import SearchAutocomplete from './components/SearchAutocomplete';
import History from './components/History';
import Result from './components/Result';
import Home from './components/Home';
import SongList from './components/SongList';
import JoinGame from './components/JoinGame';
import Lobby from './components/Lobby';
import { useGameState } from './hooks/useGameState';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import './App.css';

type Screen = 'home' | 'random' | 'list' | 'join' | 'lobby';

function parseGameIdFromPath(): string | null {
  const match = window.location.pathname.match(/^\/game\/([^/]+)$/);
  return match ? match[1] : null;
}

function getPersistedPlayerId(gameId: string | null): string | null {
  return gameId ? localStorage.getItem(`playerId:${gameId}`) : null;
}

export default function App() {
  const [gameId, setGameId] = useState<string | null>(() => parseGameIdFromPath());
  const [playerId, setPlayerId] = useState<string | null>(() => getPersistedPlayerId(parseGameIdFromPath()));
  const [screen, setScreen] = useState<Screen>(() => {
    const urlGameId = parseGameIdFromPath();
    if (!urlGameId) return 'home';
    return getPersistedPlayerId(urlGameId) ? 'lobby' : 'join';
  });
  const { state, titles, activeSongId, error, guess, skip, reset, startRandom, selectSong, clearError } =
    useGameState();
  const [inputValue, setInputValue] = useState('');

  const allowedSeconds = state?.allowedSeconds ?? 1;
  const {
    audioRef,
    progress,
    playError,
    volume,
    isPlaying,
    play,
    pause,
    handleAudioPlay,
    handleAudioPause,
    handleEnded,
    resetProgress,
    setVolume,
  } = useAudioPlayer(allowedSeconds);

  const showQuiz = screen === 'random' || (screen === 'list' && activeSongId !== null);
  const finished = !!state && state.status !== 'playing';
  const isLastAttempt = !!state && !finished && state.attemptsUsed === state.maxAttempts - 1;

  async function handleSubmit() {
    await guess(inputValue);
    setInputValue('');
  }

  async function handleReset() {
    await reset();
    setInputValue('');
    resetProgress();
  }

  async function handleSelectRandom() {
    setScreen('random');
    setInputValue('');
    resetProgress();
    await startRandom();
  }

  async function handleSelectSong(id: number) {
    setInputValue('');
    resetProgress();
    await selectSong(id);
  }

  function handleGameCreated(newGameId: string, hostToken: string) {
    localStorage.setItem(`hostToken:${newGameId}`, hostToken);
    window.history.pushState(null, '', `/game/${newGameId}`);
    setGameId(newGameId);
    setScreen('join');
  }

  function handleJoined(newPlayerId: string) {
    setPlayerId(newPlayerId);
    setScreen('lobby');
  }

  function handleSessionInvalid() {
    if (gameId) localStorage.removeItem(`playerId:${gameId}`);
    setPlayerId(null);
    setScreen('join');
  }

  function handleLeave() {
    if (gameId) {
      localStorage.removeItem(`playerId:${gameId}`);
      localStorage.removeItem(`hostToken:${gameId}`);
    }
    window.history.pushState(null, '', '/');
    setGameId(null);
    setPlayerId(null);
    setScreen('home');
  }

  return (
    <main className="app">
      <div className="app-header">
        <h1>
          <ShinyText text="LLMQ" speed={3} />
        </h1>
        {screen !== 'home' && (
          <button type="button" className="secondary" onClick={() => setScreen('home')}>
            Accueil
          </button>
        )}
      </div>

      {screen === 'home' && (
        <Home
          onSelectRandom={handleSelectRandom}
          onSelectList={() => setScreen('list')}
          onGameCreated={handleGameCreated}
        />
      )}

      {screen === 'join' && gameId && <JoinGame gameId={gameId} onJoined={handleJoined} />}

      {screen === 'lobby' && gameId && playerId && (
        <Lobby gameId={gameId} playerId={playerId} onSessionInvalid={handleSessionInvalid} onLeave={handleLeave} />
      )}

      {(screen === 'random' || screen === 'list') && (
        <div className={screen === 'list' ? 'game-layout' : undefined}>
          {screen === 'list' && (
            <SongList titles={titles} activeSongId={activeSongId} onSelect={handleSelectSong} />
          )}

          <div className="quiz-area">
            {!showQuiz && <p className="subtitle">Choisis une chanson dans la liste pour commencer.</p>}
            {showQuiz && state && (
              <>
                <p className="subtitle">Devine le titre à partir de l'intro</p>

                <Player
                  audioRef={audioRef}
                  allowedSeconds={allowedSeconds}
                  progress={progress}
                  disabled={false}
                  volume={volume}
                  isPlaying={isPlaying}
                  onPlay={play}
                  onPause={pause}
                  onAudioPlay={handleAudioPlay}
                  onAudioPause={handleAudioPause}
                  onEnded={handleEnded}
                  onVolumeChange={setVolume}
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
                      {isLastAttempt ? 'Abandonner' : 'Passer'}
                    </button>
                  </div>
                  <p className="error-msg" role="alert">
                    {error || playError}
                  </p>
                </section>

                <History guesses={state.guesses} />

                {finished && <Result state={state} onReset={screen === 'random' ? handleReset : undefined} />}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
