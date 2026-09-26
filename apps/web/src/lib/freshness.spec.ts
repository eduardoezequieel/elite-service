import { ALWAYS_FRESH, LIVE_SAFETY_POLL_MS, listPollMs, OFFLINE_POLL_MS } from './freshness';

describe('freshness (spec 062)', () => {
  it('keeps polling while the stream is live, just slower', () => {
    expect(listPollMs(true)).toBe(LIVE_SAFETY_POLL_MS);
    expect(listPollMs(false)).toBe(OFFLINE_POLL_MS);
    expect(LIVE_SAFETY_POLL_MS).toBeGreaterThan(OFFLINE_POLL_MS);
  });

  it('refetches on mount, focus and reconnect regardless of staleTime', () => {
    expect(ALWAYS_FRESH).toEqual({
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
    });
  });
});
