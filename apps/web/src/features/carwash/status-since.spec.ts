import type { Ticket } from '@elite/shared';

import { statusSinceOf } from './status-since';

type Input = Pick<Ticket, 'status' | 'createdAt' | 'washingStartedAt' | 'readyAt' | 'payments'>;

const CREATED = '2026-09-26T14:27:00.000Z';
const WASHING = '2026-09-26T15:14:00.000Z';
const READY = '2026-09-26T15:52:00.000Z';
const PAID = '2026-09-26T16:04:00.000Z';

function ticket(overrides: Partial<Input> = {}): Input {
  return {
    status: 'OPEN',
    createdAt: CREATED,
    washingStartedAt: null,
    readyAt: null,
    payments: [],
    ...overrides,
  };
}

describe('desde cuándo está en su estado (064)', () => {
  it('en espera sin haber salido de la cola cuenta desde la entrada', () => {
    expect(statusSinceOf(ticket())).toBe(CREATED);
  });

  it('en espera después de volver de listo no inventa la hora', () => {
    expect(statusSinceOf(ticket({ readyAt: READY }))).toBeNull();
  });

  it('lavando cuenta desde que empezó', () => {
    expect(statusSinceOf(ticket({ status: 'WASHING', washingStartedAt: WASHING }))).toBe(WASHING);
  });

  it('listo cuenta desde la última entrada a listo', () => {
    expect(
      statusSinceOf(ticket({ status: 'READY', washingStartedAt: WASHING, readyAt: READY })),
    ).toBe(READY);
  });

  it('cobrado usa la hora del cobro', () => {
    const paid = ticket({
      status: 'PAID',
      readyAt: READY,
      payments: [
        {
          method: 'CASH',
          amount: '8.00',
          paidAt: PAID,
          recordedBy: { id: 'u-1', fullName: 'Administrador' },
        },
      ],
    });

    expect(statusSinceOf(paid)).toBe(PAID);
  });

  it('anulado no tiene hora', () => {
    expect(statusSinceOf(ticket({ status: 'VOID' }))).toBeNull();
  });
});
