import { API_ERROR_CODES } from '@elite/shared';
import type { ApiErrorResponse } from '@elite/shared';

import { ApplicationError } from '../../../common/errors/application-error';
import { applicationErrorStatus } from '../../../common/filters/application-error-status';
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
    if (error instanceof ApplicationError) {
      return { status: applicationErrorStatus(error), body: error.payload };
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
      counterSaleId: null,
      saleNumber: null,
      method: 'CASH',
      amount: 1400,
      paidAt: new Date('2026-09-03T13:00:00.000Z'),
    });
    sessions.addPayment(open.id, {
      workOrderId: 'wo-2',
      ticketNumber: 'CW-0002',
      counterSaleId: null,
      saleNumber: null,
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
      counterSaleId: null,
      saleNumber: null,
      method: 'CASH',
      amount: 1400,
      paidAt: new Date('2026-09-03T13:00:00.000Z'),
    });

    const closed = await useCases.close({ countedCash: '33.00' }, ANA.id);

    expect(closed.expectedCash).toBe('34.00');
    expect(closed.differenceCash).toBe('-1.00');
    expect(closed.status).toBe('CLOSED');
  });

  it('desglosa transferencias por cuenta y suma «Otro» aparte, en vivo y al cerrar (069 RN-7)', async () => {
    const { useCases, sessions } = build();
    const open = await useCases.open({ openingFloat: '20.00' }, ANA.id);
    const agricola = {
      id: 'acc-agricola',
      bank: 'AGRICOLA',
      bankName: 'Banco Agrícola',
      type: 'CHECKING',
      number: '0012345678',
    } as const;
    const bac = {
      id: 'acc-bac',
      bank: 'BAC',
      bankName: 'BAC Credomatic',
      type: 'SAVINGS',
      number: '99887766',
    } as const;
    const base = {
      workOrderId: 'wo-1',
      ticketNumber: 'CW-0001',
      counterSaleId: null,
      saleNumber: null,
      paidAt: new Date('2026-09-03T13:00:00.000Z'),
    };

    sessions.addPayment(open.id, {
      ...base,
      method: 'TRANSFER',
      amount: 2000,
      bankAccount: agricola,
      reference: '998877',
    });
    sessions.addPayment(open.id, { ...base, method: 'TRANSFER', amount: 1500, bankAccount: bac });
    sessions.addPayment(open.id, { ...base, method: 'OTHER', amount: 500, description: 'cheque' });
    // Una transferencia anterior a la 069: sin cuenta.
    sessions.addPayment(open.id, { ...base, method: 'TRANSFER', amount: 300 });

    const expected = {
      transferTotal: '38.00',
      otherTotal: '5.00',
      expectedCash: '20.00',
      transferByAccount: [
        { bankAccountId: 'acc-bac', label: 'BAC Credomatic · Ahorro · ···7766', total: '15.00' },
        {
          bankAccountId: 'acc-agricola',
          label: 'Banco Agrícola · Corriente · ···5678',
          total: '20.00',
        },
        { bankAccountId: null, label: 'Sin cuenta', total: '3.00' },
      ],
    };

    expect(await useCases.current()).toMatchObject(expected);

    const closed = await useCases.close({ countedCash: '20.00' }, ANA.id);

    expect(closed).toMatchObject({ ...expected, differenceCash: '0.00' });

    const detail = await useCases.getById(open.id);

    expect(detail.payments[0]).toMatchObject({ bankAccount: agricola, reference: '998877' });
    expect(detail.payments[2]).toMatchObject({ method: 'OTHER', description: 'cheque' });
  });
});
