import { FLOOR_REFRESH_LABELS, OFFICE_REFRESH_LABELS, refreshState } from './live-label';

describe('refreshState', () => {
  it('lo que está en vuelo manda sobre todo lo demás', () => {
    expect(refreshState(true, true)).toBe('fetching');
    expect(refreshState(false, true)).toBe('fetching');
  });

  it('con el hilo abierto dice que está en vivo', () => {
    expect(refreshState(true, false)).toBe('live');
  });

  it('sin hilo cae al refresco periódico, y lo dice', () => {
    expect(refreshState(false, false)).toBe('polling');
  });
});

describe('las palabras', () => {
  it('oficina encadena detrás de la fecha', () => {
    expect(OFFICE_REFRESH_LABELS.live).toBe(' · en vivo');
  });

  it('pista lo dice solo, y nunca en mayúsculas forzadas', () => {
    expect(FLOOR_REFRESH_LABELS.live).toBe('En vivo');
    expect(
      Object.values(FLOOR_REFRESH_LABELS).every((label) => label !== label.toUpperCase()),
    ).toBe(true);
  });
});
