import type { LastWash } from '@elite/shared';

import {
  lastWashDateLabel,
  lastWashNote,
  lastWashPaymentLabel,
  lastWashWashersLabel,
} from './last-wash';

function lastWash(overrides: Partial<LastWash> = {}): LastWash {
  return {
    id: 'ticket-1',
    number: 'CW-0048',
    createdAt: '2026-08-12T15:00:00.000Z',
    washers: ['Carlos Mejía'],
    items: [
      { serviceName: 'Lavado + aspirado', unitPrice: '15.00' },
      { serviceName: 'Encerado', unitPrice: '7.00' },
    ],
    total: '22.00',
    payment: { method: 'CASH', paidAt: '2026-08-12T16:10:00.000Z' },
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

describe('quién lavó el carro la vez anterior (057)', () => {
  it('un solo lavador va con su nombre completo', () => {
    expect(lastWashWashersLabel(lastWash())).toBe('Carlos Mejía');
  });

  it('varios lavadores se separan con coma, en el orden que vinieron', () => {
    expect(lastWashWashersLabel(lastWash({ washers: ['Carlos Mejía', 'José Peña'] }))).toBe(
      'Carlos Mejía, José Peña',
    );
  });

  it('sin lavador lo despachó la oficina', () => {
    expect(lastWashWashersLabel(lastWash({ washers: [] }))).toBe('Oficina');
  });

  it('un nombre en blanco no cuenta como lavador', () => {
    expect(lastWashWashersLabel(lastWash({ washers: ['  '] }))).toBe('Oficina');
  });
});

describe('cómo se pagó el lavado anterior (057)', () => {
  it('dice el método con el mismo nombre que la caja', () => {
    expect(lastWashPaymentLabel(lastWash())).toBe('Efectivo');
    expect(
      lastWashPaymentLabel(
        lastWash({ payment: { method: 'CARD', paidAt: '2026-08-12T16:10:00.000Z' } }),
      ),
    ).toBe('Tarjeta');
    expect(
      lastWashPaymentLabel(
        lastWash({ payment: { method: 'TRANSFER', paidAt: '2026-08-12T16:10:00.000Z' } }),
      ),
    ).toBe('Transferencia');
  });

  it('un lavado que nadie cobró lo dice, no se calla', () => {
    expect(lastWashPaymentLabel(lastWash({ payment: null }))).toBe('Sin cobrar');
  });
});
