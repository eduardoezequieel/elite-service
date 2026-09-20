import type { Ticket } from '@elite/shared';

import { elapsedLabel } from './elapsed';

const ENTERED = '2026-09-20T19:05:00.000Z';
const NOW = new Date('2026-09-20T20:30:00.000Z').getTime();

type Input = Pick<Ticket, 'status' | 'createdAt' | 'payment'>;

function ticket(overrides: Partial<Input> = {}): Input {
  return { status: 'OPEN', createdAt: ENTERED, payment: null, ...overrides };
}

const paid = ticket({
  status: 'PAID',
  payment: {
    method: 'CASH',
    amount: '13.00',
    paidAt: '2026-09-20T20:21:00.000Z',
    recordedBy: { id: 'u-1', fullName: 'Administrador' },
  },
});

describe('el tiempo del carro en el taller (053)', () => {
  it('un lavado cobrado mide de la entrada al cobro', () => {
    expect(elapsedLabel(paid, NOW)).toBe('1 h 16 min');
  });

  it('y ese número ya no se mueve con el reloj', () => {
    expect(elapsedLabel(paid, NOW + 3_600_000)).toBe(elapsedLabel(paid, NOW));
  });

  it('un lavado anulado no muestra duración', () => {
    expect(elapsedLabel(ticket({ status: 'VOID' }), NOW)).toBeNull();
  });

  it('un lavado en la bahía cuenta desde que entró, no desde que arrancó a lavar', () => {
    expect(elapsedLabel(ticket({ status: 'WASHING' }), NOW)).toBe('1 h 25 min');
  });

  it('un cobro anterior al registro del pago cae al tramo vivo', () => {
    expect(elapsedLabel(ticket({ status: 'PAID' }), NOW)).toBe('1 h 25 min');
  });

  it('el que acaba de entrar cuenta en segundos', () => {
    expect(elapsedLabel(ticket({ createdAt: new Date(NOW - 12_000).toISOString() }), NOW)).toBe(
      '12 s',
    );
  });
});
