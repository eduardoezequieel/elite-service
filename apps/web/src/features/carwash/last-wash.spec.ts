import type { LastWash } from '@elite/shared';

import { lastWashDateLabel, lastWashNote } from './last-wash';

function lastWash(overrides: Partial<LastWash> = {}): LastWash {
  return {
    createdAt: '2026-08-12T15:00:00.000Z',
    serviceName: 'Lavado + aspirado',
    notes: 'No mojar el tablero.',
    ...overrides,
  };
}

describe('la fecha del lavado anterior (052)', () => {
  it('se escribe con el día y el mes corto', () => {
    expect(lastWashDateLabel('2026-08-12T15:00:00.000Z')).toBe('12 ago');
  });
});

describe('la nota del lavado anterior (052)', () => {
  it('llega recortada', () => {
    expect(lastWashNote(lastWash({ notes: '  No mojar el tablero.  ' }))).toBe(
      'No mojar el tablero.',
    );
  });

  it('sin lavado anterior no hay nota', () => {
    expect(lastWashNote(null)).toBe('');
  });

  it('un lavado sin nota tampoco la tiene', () => {
    expect(lastWashNote(lastWash({ notes: null }))).toBe('');
  });

  it('y una nota de puros espacios vale lo mismo que ninguna', () => {
    expect(lastWashNote(lastWash({ notes: '   \n  ' }))).toBe('');
  });
});
