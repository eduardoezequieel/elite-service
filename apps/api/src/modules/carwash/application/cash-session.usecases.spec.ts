import { API_ERROR_CODES } from '@elite/shared';
import type { ApiErrorResponse } from '@elite/shared';
import { HttpException } from '@nestjs/common';

import { CashSessionUseCases } from './cash-session.usecases';
import { InMemoryCashSessionRepository } from './testing/in-memory-cash-session.repository';

const ANA = { id: 'user-ana', fullName: 'Ana Ramírez' };
const LUIS = { id: 'user-luis', fullName: 'Luis Pérez' };

function build(): { useCases: CashSessionUseCases; sessions: InMemoryCashSessionRepository } {
  const sessions = new InMemoryCashSessionRepository();
  sessions.addUser(ANA.id, ANA.fullName);
  sessions.addUser(LUIS.id, LUIS.fullName);

  return { useCases: new CashSessionUseCases(sessions), sessions };
}

async function capture(
  action: Promise<unknown>,
): Promise<{ status: number; body: ApiErrorResponse }> {
  try {
    await action;
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() as ApiErrorResponse };
    }

    throw error;
  }

  throw new Error('Se esperaba un error del caso de uso, pero resolvió bien.');
}

describe('CashSessionUseCases', () => {
  it('opens with the given float and the opener as openedBy', async () => {
    const { useCases } = build();

    const session = await useCases.open({ openingFloat: '20.00' }, ANA.id);

    expect(session.status).toBe('OPEN');
    expect(session.openingFloat).toBe('20.00');
    expect(session.openedBy).toEqual(ANA);
    expect(session.countedCash).toBeNull();
    expect(session.differenceCash).toBeNull();
    expect(session.expectedCash).toBe('20.00');
  });

  it('rejects a second open with 409 CASH_ALREADY_OPEN and who holds it', async () => {
    const { useCases } = build();

    await useCases.open({ openingFloat: '20.00' }, ANA.id);
    const failure = await capture(useCases.open({ openingFloat: '0.00' }, LUIS.id));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.CASH_ALREADY_OPEN);
    expect(failure.body.message).toContain(ANA.fullName);
    expect(failure.body.details).toMatchObject({ openedBy: ANA });
  });

  it('rejects close without an open session with 409 CASH_NOT_OPEN', async () => {
    const { useCases } = build();

    const failure = await capture(useCases.close({ countedCash: '0.00' }, ANA.id));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.CASH_NOT_OPEN);
  });

  it('close snapshot: float 20 + cash 14 + card 10, counted 34 → difference 0', async () => {
    const { useCases, sessions } = build();
    const open = await useCases.open({ openingFloat: '20.00' }, ANA.id);

    sessions.addPayment(open.id, {
      workOrderId: 'wo-1',
      ticketNumber: 'CW-0001',
      method: 'CASH',
      amount: 1400,
      paidAt: new Date('2026-09-03T13:00:00.000Z'),
    });
    sessions.addPayment(open.id, {
      workOrderId: 'wo-2',
      ticketNumber: 'CW-0002',
      method: 'CARD',
      amount: 1000,
      paidAt: new Date('2026-09-03T13:05:00.000Z'),
    });

    const live = await useCases.current();

    expect(live?.cashTotal).toBe('14.00');
    expect(live?.cardTotal).toBe('10.00');
    expect(live?.transferTotal).toBe('0.00');
    expect(live?.expectedCash).toBe('34.00');
    expect(live?.countedCash).toBeNull();

    const closed = await useCases.close({ countedCash: '34.00' }, LUIS.id);

    expect(closed.status).toBe('CLOSED');
    expect(closed.cashTotal).toBe('14.00');
    expect(closed.cardTotal).toBe('10.00');
    expect(closed.transferTotal).toBe('0.00');
    expect(closed.expectedCash).toBe('34.00');
    expect(closed.differenceCash).toBe('0.00');
    expect(closed.countedCash).toBe('34.00');
    expect(closed.closedBy).toEqual(LUIS);
    expect(closed.paymentCount).toBe(2);
    await expect(useCases.current()).resolves.toBeNull();
  });

  it('close snapshot: counted 33 against expected 34 → difference -1.00', async () => {
    const { useCases, sessions } = build();
    const open = await useCases.open({ openingFloat: '20.00' }, ANA.id);

    sessions.addPayment(open.id, {
      workOrderId: 'wo-1',
      ticketNumber: 'CW-0001',
      method: 'CASH',
      amount: 1400,
      paidAt: new Date('2026-09-03T13:00:00.000Z'),
    });

    const closed = await useCases.close({ countedCash: '33.00' }, ANA.id);

    expect(closed.expectedCash).toBe('34.00');
    expect(closed.differenceCash).toBe('-1.00');
    expect(closed.status).toBe('CLOSED');
  });
});
