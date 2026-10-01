import {
  acceptsPayments,
  agreementHolding,
  depositHeldCents,
  depositReturnFits,
  heldInterval,
  isReceivable,
  paymentFits,
} from './billing-rules';
import type { OccupancySpan } from './billing-rules';

const at = (iso: string) => new Date(iso);

function span(overrides: Partial<OccupancySpan> & { id?: string } = {}) {
  return {
    id: 'a',
    status: 'FINISHED' as const,
    plannedPickupAt: at('2026-10-01T10:00:00Z'),
    plannedReturnAt: at('2026-10-03T10:00:00Z'),
    actualPickupAt: null,
    actualReturnAt: null,
    ...overrides,
  };
}

describe('paymentFits (RN-1)', () => {
  it('acepta hasta el saldo y rechaza cero o de más', () => {
    expect(paymentFits(3000, 5000)).toBe(true);
    expect(paymentFits(5000, 5000)).toBe(true);
    expect(paymentFits(6000, 5000)).toBe(false);
    expect(paymentFits(0, 5000)).toBe(false);
    expect(paymentFits(100, 0)).toBe(false);
  });

  it('una renta cancelada no recibe pagos', () => {
    expect(acceptsPayments('CANCELLED')).toBe(false);
    expect(acceptsPayments('RESERVED')).toBe(true);
    expect(acceptsPayments('FINISHED')).toBe(true);
  });
});

describe('depósito (RN-2)', () => {
  const held = { depositCents: 10000, returnedCents: null, transferredToId: null };

  it('en custodia solo si hay, no se devolvió y no se transfirió', () => {
    expect(depositHeldCents(held)).toBe(10000);
    expect(depositHeldCents({ ...held, depositCents: 0 })).toBe(0);
    expect(depositHeldCents({ ...held, returnedCents: 8000 })).toBe(0);
    expect(depositHeldCents({ ...held, transferredToId: 'b' })).toBe(0);
  });

  it('se devuelve una vez, de 0 hasta el depósito', () => {
    expect(depositReturnFits(held, 8000)).toBe(true);
    expect(depositReturnFits(held, 0)).toBe(true);
    expect(depositReturnFits(held, 12000)).toBe(false);
    expect(depositReturnFits({ ...held, returnedCents: 8000 }, 100)).toBe(false);
  });
});

describe('isReceivable (RN-3)', () => {
  it('en curso o finalizada con saldo', () => {
    expect(isReceivable('IN_PROGRESS', 1)).toBe(true);
    expect(isReceivable('FINISHED', 2000)).toBe(true);
    expect(isReceivable('FINISHED', 0)).toBe(false);
    expect(isReceivable('FINISHED', -500)).toBe(false);
    expect(isReceivable('RESERVED', 2000)).toBe(false);
    expect(isReceivable('CANCELLED', 2000)).toBe(false);
  });
});

describe('quién tenía el carro (RN-4)', () => {
  const now = at('2026-10-10T00:00:00Z');

  it('usa las fechas reales y si no las planificadas', () => {
    expect(
      heldInterval(
        span({
          actualPickupAt: at('2026-10-01T11:00:00Z'),
          actualReturnAt: at('2026-10-02T09:00:00Z'),
        }),
        now,
      ),
    ).toEqual({ from: at('2026-10-01T11:00:00Z'), to: at('2026-10-02T09:00:00Z') });
    expect(heldInterval(span(), now)).toEqual({
      from: at('2026-10-01T10:00:00Z'),
      to: at('2026-10-03T10:00:00Z'),
    });
  });

  it('reservada y cancelada no tienen el carro', () => {
    expect(heldInterval(span({ status: 'RESERVED' }), now)).toBeNull();
    expect(heldInterval(span({ status: 'CANCELLED' }), now)).toBeNull();
  });

  it('la renta en curso atrasada lo tiene hasta ahora', () => {
    expect(heldInterval(span({ status: 'IN_PROGRESS' }), now)?.to).toEqual(now);
  });

  it('encuentra la renta que cubre la fecha, bordes incluidos', () => {
    const first = span({ id: 'first' });
    const later = span({
      id: 'later',
      plannedPickupAt: at('2026-10-05T10:00:00Z'),
      plannedReturnAt: at('2026-10-06T10:00:00Z'),
    });

    expect(agreementHolding([first, later], at('2026-10-02T00:00:00Z'), now)?.id).toBe('first');
    expect(agreementHolding([first, later], at('2026-10-03T10:00:00Z'), now)?.id).toBe('first');
    expect(agreementHolding([first, later], at('2026-10-04T00:00:00Z'), now)).toBeNull();
    expect(agreementHolding([first, later], at('2026-10-05T12:00:00Z'), now)?.id).toBe('later');
  });

  it('en el instante de un cambio de carro gana la que empezó después', () => {
    const closed = span({ id: 'closed', actualReturnAt: at('2026-10-02T10:00:00Z') });
    const opened = span({
      id: 'opened',
      status: 'IN_PROGRESS',
      actualPickupAt: at('2026-10-02T10:00:00Z'),
      plannedReturnAt: at('2026-10-20T10:00:00Z'),
    });

    expect(agreementHolding([closed, opened], at('2026-10-02T10:00:00Z'), now)?.id).toBe('opened');
  });
});
