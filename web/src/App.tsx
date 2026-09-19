import { useState } from 'react';
import ShinyText from './components/ShinyText';
import Player from './components/Player';
import Pips from './components/Pips';
import SearchAutocomplete from './components/SearchAutocomplete';
import History from './components/History';
import Result from './components/Result';
import Home from './components/Home';
import { CAREER_STATS } from './careerStats';
import CareerHub from './components/CareerHub';
import SongList from './components/SongList';
import JoinGame from './components/JoinGame';
import Lobby from './components/Lobby';
import RandomSetup from './components/RandomSetup';
import ProfileEditor from './components/ProfileEditor';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import { useGameState } from './hooks/useGameState';
import { useCareer } from './hooks/useCareer';
import { useGenerationOptions } from './hooks/useGenerationOptions';
import { useSongHistory } from './hooks/useSongHistory';
import { useProfile } from './hooks/useProfile';
import { useToast } from './hooks/useToast';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import './App.css';

type Screen = 'home' | 'profile' | 'random-setup' | 'random' | 'career' | 'list' | 'join' | 'lobby';

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
  const { profile, avatarError, saveUsername, chooseAvatar, removeAvatar } = useProfile();
  const { message: toast, showToast } = useToast();
  const { history, adaptive, setAdaptive, recordResult, clearHistory } = useSongHistory();
  const { state, titles, activeSongId, error, guess, skip, reset, startRandom, selectSong, clearError } =
    useGameState(recordResult);
  const [inputValue, setInputValue] = useState('');
  const [confirmingHome, setConfirmingHome] = useState(false);
  const generationOptions = useGenerationOptions();
  const [randomGenerations, setRandomGenerations] = useState<string[] | null>(null);
  const selectedGenerations = randomGenerations ?? generationOptions.map((option) => option.generation);

  const careerState = useCareer();
  const careerRound = screen === 'career' ? careerState.round : null;
  const careerFinished = !!careerRound && careerRound.state.status !== 'playing';
  const careerLastAttempt =
    !!careerRound && !careerFinished && careerRound.state.attemptsUsed === careerRound.state.maxAttempts - 1;

  // The album and the concert are series of rounds played back to back.
  const career = careerState.career;
  const series =
    career && careerRound?.kind === 'release'
      ? { label: "Sortie de l'album", progress: career.album, over: !!career.release, next: careerState.release }
      : career && careerRound?.kind === 'concert'
        ? { label: 'Concert', progress: career.concert, over: !!career.concertResult, next: careerState.concert }
        : null;
  // A finished track is already counted in the series progress, a playing one is not.
  const seriesPosition = (series?.progress.done ?? 0) + (careerFinished ? 0 : 1);
  const continueLabel = !series ? 'Continuer' : series.over ? 'Voir le résultat' : 'Titre suivant';
  const roundSubtitle =
    careerRound?.kind === 'study'
      ? "Étude : deviner le titre à partir de l'intro"
      : careerRound?.kind === 'single'
        ? `Single (${CAREER_STATS.find(({ stat }) => stat === careerRound.stat)?.label}) : deviner le titre à partir de l'intro (il n'entre pas dans le carnet)`
        : `${series?.label} : titre ${seriesPosition} / ${series?.progress.total}`;

  const allowedSeconds = careerRound?.state.allowedSeconds ?? state?.allowedSeconds ?? 1;
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
  const showAnswer = screen === 'random' && finished;
  const isLastAttempt = !!state && !finished && state.attemptsUsed === state.maxAttempts - 1;

  // Leaving Mode Solo abandons its round, so an in-progress one needs a confirmation.
  const roundInProgress = screen === 'random' && !!state && !finished && state.attemptsUsed > 0;

  function handleHomeClick() {
    if (roundInProgress) setConfirmingHome(true);
    else setScreen('home');
  }

  function handleConfirmHome() {
    setConfirmingHome(false);
    setScreen('home');
  }

  async function handleSubmit() {
    await guess(inputValue);
    setInputValue('');
  }

  function handleClearHistory() {
    clearHistory();
    showToast('Historique effacé.');
  }

  async function handleReset() {
    await reset(adaptive ? history : undefined);
    setInputValue('');
    resetProgress();
  }

  async function handleStartRandom() {
    setScreen('random');
    setInputValue('');
    resetProgress();
    await startRandom(selectedGenerations.length > 0 ? selectedGenerations : undefined, adaptive ? history : undefined);
  }

  function handleSelectCareer() {
    setScreen('career');
    setInputValue('');
    resetProgress();
    void careerState.enter();
  }

  // A new career round starts on a fresh clip and an empty search field.
  async function startCareerRound(action: () => Promise<void>) {
    setInputValue('');
    resetProgress();
    await action();
  }

  // The next track of the album or concert starts right away, without going back to the hub.
  async function handleCareerContinue() {
    if (series && !series.over) await startCareerRound(series.next);
    else careerState.closeRound();
  }

  async function handleCareerSubmit() {
    await careerState.guess(inputValue);
    setInputValue('');
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
      <Toast message={toast} />
      <div className="app-header">
        <h1>
          <ShinyText text="LLMQ" speed={3} />
        </h1>
        {screen === 'home' && (
          <button type="button" className="secondary" onClick={() => setScreen('profile')}>
            Profil
          </button>
        )}
        {screen !== 'home' && !showAnswer && (
          <button type="button" className="secondary" onClick={handleHomeClick}>
            Accueil
          </button>
        )}
      </div>

      {confirmingHome && (
        <ConfirmDialog
          title="Quitter la partie ?"
          message="La partie en cours sera supprimée."
          confirmLabel="Quitter"
          cancelLabel="Continuer"
          onConfirm={handleConfirmHome}
          onCancel={() => setConfirmingHome(false)}
        />
      )}

      {screen === 'home' && (
        <Home
          onSelectRandom={() => setScreen('random-setup')}
          onSelectCareer={handleSelectCareer}
          onSelectList={() => setScreen('list')}
          onGameCreated={handleGameCreated}
        />
      )}

      {screen === 'profile' && (
        <ProfileEditor
          username={profile.username}
          avatar={profile.avatar}
          avatarError={avatarError}
          onSave={saveUsername}
          onAvatarFile={chooseAvatar}
          onAvatarRemove={removeAvatar}
        />
      )}

      {screen === 'random-setup' && (
        <RandomSetup
          options={generationOptions}
          selected={selectedGenerations}
          onChange={setRandomGenerations}
          adaptive={adaptive}
          onAdaptiveChange={setAdaptive}
          onClearHistory={handleClearHistory}
          onStart={handleStartRandom}
        />
      )}

      {screen === 'join' && gameId && <JoinGame
          gameId={gameId}
          defaultNickname={profile.username}
          defaultAvatar={profile.avatar}
          onJoined={handleJoined}
        />}

      {screen === 'lobby' && gameId && playerId && (
        <Lobby gameId={gameId} playerId={playerId} onSessionInvalid={handleSessionInvalid} onLeave={handleLeave} />
      )}

      {screen === 'career' && !careerRound && (
        <CareerHub
          career={careerState.career}
          error={careerState.error}
          onBegin={() => startCareerRound(careerState.begin)}
          onRest={careerState.rest}
          onStudy={(stat) => startCareerRound(() => careerState.study(stat))}
          onSingle={() => startCareerRound(careerState.single)}
          onRelease={() => startCareerRound(careerState.release)}
          onConcert={() => startCareerRound(careerState.concert)}
          onRestart={careerState.abandon}
        />
      )}

      {careerRound && (
        <div className="quiz-area">
          <p className="subtitle">{roundSubtitle}</p>

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

          <Pips maxAttempts={careerRound.state.maxAttempts} guesses={careerRound.state.guesses} />

          <section className="search-section">
            <SearchAutocomplete
              titles={titles}
              value={inputValue}
              disabled={careerFinished}
              maxSuggestions={careerState.career?.suggestionCount}
              onChange={(v) => {
                setInputValue(v);
                careerState.clearError();
              }}
              onSubmit={handleCareerSubmit}
            />
            <div className="actions">
              <button type="button" id="guess-btn" disabled={careerFinished} onClick={handleCareerSubmit}>
                Valider
              </button>
              <button type="button" className="secondary" disabled={careerFinished} onClick={careerState.skip}>
                {careerLastAttempt ? 'Abandonner' : 'Passer'}
              </button>
            </div>
            <p className="error-msg" role="alert">
              {careerState.error || playError}
            </p>
          </section>

          <History guesses={careerRound.state.guesses} />

          {careerFinished && (
            <>
              <Result state={careerRound.state} />
              <div className="result-actions">
                <button type="button" onClick={handleCareerContinue}>
                  {continueLabel}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showAnswer && state && (
        <Result state={state} onNextSong={handleReset} onHome={() => setScreen('home')} />
      )}

      {(screen === 'list' || (screen === 'random' && !showAnswer)) && (
        <div className={screen === 'list' ? 'game-layout' : undefined}>
          {screen === 'list' && (
            <SongList titles={titles} activeSongId={activeSongId} onSelect={handleSelectSong} />
          )}

          <div className="quiz-area">
            {!showQuiz && <p className="subtitle">Choisir une chanson dans la bibliothèque pour commencer.</p>}
            {showQuiz && state && (
              <>
                <p className="subtitle">Deviner le titre à partir de l'intro</p>

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

                {finished && <Result state={state} />}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
