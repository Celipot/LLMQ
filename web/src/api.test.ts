import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  audioTrackUrl,
  careerAudioTrackUrl,
  fetchCareer,
  fetchState,
  resetGame,
  restCareer,
  startCareer,
  selectSong,
  startRandomMode,
  submitGuess,
  submitSkip,
} from './api';

const fetchMock = vi.fn();

function sentSessionId(callIndex: number): string {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit | undefined;
  return new Headers(init?.headers).get('X-Solo-Session') ?? '';
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('solo session id', () => {
  it('is sent as X-Solo-Session on every solo request', async () => {
    await fetchState();
    await submitGuess('Snow halation');
    await resetGame();
    await startRandomMode();
    await selectSong(3);

    for (let i = 0; i < 5; i++) expect(sentSessionId(i)).toMatch(/^[a-f0-9]{32}$/);
  });

  it('stays the same across requests and survives a reload of the tab', async () => {
    await fetchState();
    await fetchState();

    expect(sentSessionId(1)).toBe(sentSessionId(0));
    expect(sessionStorage.getItem('soloSessionId')).toBe(sentSessionId(0));
  });

  it('is kept per tab, never shared through localStorage, so two tabs are two players', async () => {
    await fetchState();

    expect(localStorage.getItem('soloSessionId')).toBeNull();
  });

  it('reuses the id already stored for this tab', async () => {
    sessionStorage.setItem('soloSessionId', 'abcdefabcdefabcdefabcdefabcdefab');

    await fetchState();

    expect(sentSessionId(0)).toBe('abcdefabcdefabcdefabcdefabcdefab');
  });

  it('is appended to the audio url because <audio> cannot send headers', () => {
    sessionStorage.setItem('soloSessionId', 'abcdefabcdefabcdefabcdefabcdefab');

    expect(audioTrackUrl()).toContain('sid=abcdefabcdefabcdefabcdefabcdefab');
  });

  it('keeps working with an in-memory id when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    await fetchState();
    await fetchState();

    expect(sentSessionId(0)).toMatch(/^[a-f0-9]{32}$/);
    expect(sentSessionId(1)).toBe(sentSessionId(0));
  });
});

describe('career session id', () => {
  const CAREER_ID = 'fedcbafedcbafedcbafedcbafedcbafe';

  it('is sent on every career request, apart from the tab id of the solo modes', async () => {
    await fetchState();
    await fetchCareer();
    await restCareer();

    expect(sentSessionId(1)).toMatch(/^[a-f0-9]{32}$/);
    expect(sentSessionId(1)).not.toBe(sentSessionId(0));
    expect(sentSessionId(2)).toBe(sentSessionId(1));
  });

  it('is stored in localStorage, so closing the tab does not lose the career', async () => {
    await fetchCareer();

    expect(localStorage.getItem('careerSessionId')).toBe(sentSessionId(0));
    expect(sessionStorage.getItem('careerSessionId')).toBeNull();
  });

  it('starting a career sends the chosen unit and difficulty', async () => {
    await startCareer({ unit: 'qu4rtz', difficulty: 'normal' });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toBe('/api/career');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ unit: 'qu4rtz', difficulty: 'normal' });
  });

  it('reuses the id already stored by a previous visit', async () => {
    localStorage.setItem('careerSessionId', CAREER_ID);

    await fetchCareer();

    expect(sentSessionId(0)).toBe(CAREER_ID);
  });

  it('is used by the guesses and skips of a career round', async () => {
    localStorage.setItem('careerSessionId', CAREER_ID);

    await submitGuess('Snow halation', 'career');
    await submitSkip('career');

    expect(sentSessionId(0)).toBe(CAREER_ID);
    expect(sentSessionId(1)).toBe(CAREER_ID);
  });

  it('is appended to the audio url of a career round', () => {
    localStorage.setItem('careerSessionId', CAREER_ID);

    expect(careerAudioTrackUrl()).toContain(`sid=${CAREER_ID}`);
  });

  it('keeps working with an in-memory id when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    await fetchCareer();
    await fetchCareer();

    expect(sentSessionId(1)).toBe(sentSessionId(0));
  });
});
