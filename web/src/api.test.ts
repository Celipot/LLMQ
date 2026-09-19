import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioTrackUrl, fetchState, resetGame, selectSong, startRandomMode, submitGuess } from './api';

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
