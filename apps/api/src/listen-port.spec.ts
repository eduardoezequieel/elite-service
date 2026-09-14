import { resolveListenPort } from './listen-port';

describe('resolveListenPort', () => {
  it('uses PORT when it is the only value (Render)', () => {
    expect(resolveListenPort({ PORT: '10000' })).toBe(10000);
  });

  it('uses API_PORT when both PORT and API_PORT are set (local .env)', () => {
    expect(resolveListenPort({ PORT: '3100', API_PORT: '3200' })).toBe(3200);
  });

  it('uses API_PORT when PORT is absent', () => {
    expect(resolveListenPort({ API_PORT: '3200' })).toBe(3200);
  });

  it('falls back to 3200 when nothing is set', () => {
    expect(resolveListenPort({})).toBe(3200);
  });

  it('ignores empty or invalid values and keeps walking the fallbacks', () => {
    expect(resolveListenPort({ PORT: ' ', API_PORT: '3200' })).toBe(3200);
    expect(resolveListenPort({ PORT: 'nope' })).toBe(3200);
    expect(resolveListenPort({ PORT: '0', API_PORT: '4000' })).toBe(4000);
    expect(resolveListenPort({ PORT: '-1' })).toBe(3200);
  });
});
