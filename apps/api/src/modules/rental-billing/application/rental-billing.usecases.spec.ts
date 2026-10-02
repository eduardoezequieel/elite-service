import { API_ERROR_CODES, cashQuerySchema, finesQuerySchema } from '@elite/shared';
import type { FinesQuery } from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import { RentalCashUseCases } from './rental-cash.usecases';
import { RentalFineUseCases } from './rental-fine.usecases';
import { RentalPaymentUseCases } from './rental-payment.usecases';
import { InMemoryBilling, agreementRecord } from './testing/in-memory-billing';

const NOW = new Date('2026-10-01T18:00:00Z'); // 12:00 en El Salvador
const clock = () => NOW;
const ACTOR = { id: 'user-1' };
const PAGE = { page: 1, pageSize: 50 };

function setup() {
  const store = new InMemoryBilling();
  // Total 50: 2 días × 25.
  store.add(agreementRecord({ id: 'a1', contractNumber: 733 }));

  return {
    store,
    payments: new RentalPaymentUseCases(store, store, store, clock),
    fines: new RentalFineUseCases(store, store, clock),
    cash: new RentalCashUseCases(store, store, store, clock),
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un error');
}

describe('RentalPaymentUseCases (098)', () => {
  it('registra un pago: el saldo baja y queda quién lo recibió', async () => {
    const { store, payments } = setup();

    const payment = await payments.addPayment(
      'a1',
      { amount: '30.00', method: 'CASH', reference: null, note: null },
      ACTOR,
    );

    expect(payment).toMatchObject({
      amount: '30.00',
      method: 'CASH',
      receivedByUserId: 'user-1',
      receivedByName: 'Caja Uno',
      paidAt: NOW.toISOString(),
      voidedAt: null,
    });
    expect(store.agreements[0]?.payments).toHaveLength(1);
  });

  it('un pago que pasa del saldo -> 409 PAYMENT_EXCEEDS_BALANCE (RN-1)', async () => {
    const { payments } = setup();
    await payments.addPayment('a1', { amount: '30.00', method: 'CASH' }, ACTOR);

    const error = await rejection(
      payments.addPayment('a1', { amount: '30.00', method: 'CARD' }, ACTOR),
    );

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: API_ERROR_CODES.PAYMENT_EXCEEDS_BALANCE,
      details: { balance: '20.00' },
    });
  });

  it('una renta cancelada no recibe pagos y una que no existe es 404', async () => {
    const { store, payments } = setup();
    store.add(agreementRecord({ id: 'c1', status: 'CANCELLED' }));

    expect(
      await rejection(payments.addPayment('c1', { amount: '1.00', method: 'CASH' }, ACTOR)),
    ).toMatchObject({ code: API_ERROR_CODES.AGREEMENT_CLOSED });
    expect(
      await rejection(payments.addPayment('nope', { amount: '1.00', method: 'CASH' }, ACTOR)),
    ).toBeInstanceOf(NotFoundError);
  });

  it('las multas cargadas suben el saldo que se puede cobrar', async () => {
    const { payments, fines } = setup();
    await fines.create(
      {
        vehicleId: 'vehicle-1',
        occurredAt: '2026-10-02T12:00:00Z',
        amount: '10.00',
        description: 'Mal estacionado',
        chargeToCustomer: true,
      },
      ACTOR,
    );

    await expect(
      payments.addPayment('a1', { amount: '60.00', method: 'TRANSFER' }, ACTOR),
    ).resolves.toMatchObject({ amount: '60.00' });
  });

  it('anular deja voidedAt, deja de sumar y no se anula dos veces', async () => {
    const { payments } = setup();
    const paid = await payments.addPayment('a1', { amount: '50.00', method: 'CASH' }, ACTOR);

    const voided = await payments.voidPayment(paid.id, { reason: 'Doble cobro' }, ACTOR);

    expect(voided).toMatchObject({
      voidedAt: NOW.toISOString(),
      voidReason: 'Doble cobro',
      voidedByName: 'Caja Uno',
    });
    // El saldo volvió a 50: se puede cobrar de nuevo.
    await expect(
      payments.addPayment('a1', { amount: '50.00', method: 'CARD' }, ACTOR),
    ).resolves.toBeDefined();
    expect(
      await rejection(payments.voidPayment(paid.id, { reason: 'Otra vez' }, ACTOR)),
    ).toMatchObject({ code: API_ERROR_CODES.CONFLICT });
    expect(await rejection(payments.voidPayment('nope', { reason: 'X' }, ACTOR))).toBeInstanceOf(
      NotFoundError,
    );
  });

  it('devuelve el depósito una sola vez y hasta lo que se guarda (RN-2)', async () => {
    const { store, payments } = setup();
    store.add(agreementRecord({ id: 'd1', deposit: '100.00' }));

    expect(
      await rejection(payments.returnDeposit('d1', { amount: '120.00' }, ACTOR)),
    ).toMatchObject({ code: API_ERROR_CODES.DEPOSIT_EXCEEDS_HELD });

    const view = await payments.returnDeposit(
      'd1',
      { amount: '80.00', note: 'Rayón en la puerta' },
      ACTOR,
    );

    expect(view.depositReturnedAmount).toBe('80.00');
    expect(
      await rejection(payments.returnDeposit('d1', { amount: '10.00', note: 'x' }, ACTOR)),
    ).toMatchObject({ code: API_ERROR_CODES.DEPOSIT_EXCEEDS_HELD });
  });

  it('retener una parte sin nota -> 422; devolver todo no la pide', async () => {
    const { store, payments } = setup();
    store.add(agreementRecord({ id: 'd2', deposit: '100.00' }));

    expect(
      await rejection(payments.returnDeposit('d2', { amount: '80.00' }, ACTOR)),
    ).toBeInstanceOf(ValidationError);
    await expect(payments.returnDeposit('d2', { amount: '100.00' }, ACTOR)).resolves.toMatchObject({
      depositReturnedAmount: '100.00',
    });
  });

  it('un depósito transferido a otra renta ya no se devuelve desde esta', async () => {
    const { store, payments } = setup();
    store.add(agreementRecord({ id: 'd3', deposit: '100.00', depositTransferredToId: 'd4' }));

    expect(
      await rejection(payments.returnDeposit('d3', { amount: '100.00' }, ACTOR)),
    ).toMatchObject({ code: API_ERROR_CODES.DEPOSIT_EXCEEDS_HELD });
  });
});

describe('RentalFineUseCases (RN-4)', () => {
  const fine = {
    vehicleId: 'vehicle-1',
    amount: '57.14',
    description: 'Exceso de velocidad',
  };

  it('dentro de una renta se liga a ella y entra al total si se carga', async () => {
    const { store, fines } = setup();

    const created = await fines.create(
      { ...fine, occurredAt: '2026-10-02T12:00:00Z', chargeToCustomer: true },
      ACTOR,
    );

    expect(created).toMatchObject({
      agreementId: 'a1',
      agreement: { contractNumber: 733, customerName: 'Ana Pérez' },
      chargedToCustomer: true,
    });
    expect(store.agreements[0]?.fines).toHaveLength(1);
  });

  it('sin renta en esa fecha queda como multa del carro; cargarla al cliente -> 422', async () => {
    const { fines } = setup();

    expect(
      await rejection(
        fines.create(
          { ...fine, occurredAt: '2026-11-01T12:00:00Z', chargeToCustomer: true },
          ACTOR,
        ),
      ),
    ).toBeInstanceOf(ValidationError);
    await expect(
      fines.create({ ...fine, occurredAt: '2026-11-01T12:00:00Z', chargeToCustomer: false }, ACTOR),
    ).resolves.toMatchObject({ agreementId: null, chargedToCustomer: false });
  });

  it('una reservada no tenía el carro', async () => {
    const { store, fines } = setup();
    store.agreements[0]!.status = 'RESERVED';

    await expect(
      fines.resolve({ vehicleId: 'vehicle-1', occurredAt: '2026-10-02T12:00:00Z' }),
    ).resolves.toEqual({ agreement: null });
  });

  it('resolve dice a quién se le cargaría antes de guardar', async () => {
    const { fines } = setup();

    await expect(
      fines.resolve({ vehicleId: 'vehicle-1', occurredAt: '2026-10-02T12:00:00Z' }),
    ).resolves.toEqual({
      agreement: { id: 'a1', contractNumber: 733, customerName: 'Ana Pérez' },
    });
  });

  it('un carro que no existe -> 404', async () => {
    const { fines } = setup();

    expect(
      await rejection(
        fines.create(
          {
            ...fine,
            vehicleId: 'nope',
            occurredAt: '2026-10-02T12:00:00Z',
            chargeToCustomer: false,
          },
          ACTOR,
        ),
      ),
    ).toBeInstanceOf(NotFoundError);
  });

  it('lista por carro, renta y rango civil', async () => {
    const { fines } = setup();
    await fines.create(
      { ...fine, occurredAt: '2026-10-02T12:00:00Z', chargeToCustomer: true },
      ACTOR,
    );
    await fines.create(
      { ...fine, occurredAt: '2026-11-05T12:00:00Z', chargeToCustomer: false },
      ACTOR,
    );

    const list = (filter: Partial<FinesQuery>) => fines.list({ ...PAGE, ...filter });

    expect((await list({ agreementId: 'a1' })).items).toHaveLength(1);
    expect((await list({ vehicleId: 'vehicle-1' })).items).toHaveLength(2);
    expect((await list({ from: '2026-11-01', to: '2026-11-30' })).items).toHaveLength(1);
  });

  it('pagina la más reciente primero, con el total del filtro (101)', async () => {
    const { fines } = setup();
    for (const occurredAt of ['2026-10-02T12:00:00Z', '2026-10-03T12:00:00Z']) {
      await fines.create({ ...fine, occurredAt, chargeToCustomer: false }, ACTOR);
    }

    const second = await fines.list(finesQuerySchema.parse({ page: '2', pageSize: '1' }));

    expect(second).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(second.items.map((row) => row.occurredAt)).toEqual(['2026-10-02T12:00:00.000Z']);
  });
});

describe('RentalCashUseCases', () => {
  it('suma el día por método y por usuario, y aparta los anulados', async () => {
    const { store, payments, cash } = setup();
    store.users.set('user-2', 'Caja Dos');
    store.add(agreementRecord({ id: 'a2', contractNumber: 734, customerName: 'Luis Gómez' }));

    await payments.addPayment('a1', { amount: '30.00', method: 'CASH' }, ACTOR);
    await payments.addPayment(
      'a2',
      { amount: '20.00', method: 'CARD', reference: 'V-1' },
      { id: 'user-2' },
    );
    const wrong = await payments.addPayment('a2', { amount: '5.00', method: 'CASH' }, ACTOR);
    await payments.voidPayment(wrong.id, { reason: 'Error' }, ACTOR);
    // Ayer en El Salvador (antes de las 06:00 UTC de hoy): no entra.
    await payments.addPayment(
      'a1',
      { amount: '1.00', method: 'CASH', paidAt: '2026-10-01T05:59:00Z' },
      ACTOR,
    );

    const report = await cash.report(cashQuerySchema.parse({}));

    expect(report.date).toBe('2026-10-01');
    expect(report.total).toBe('50.00');
    expect(report.byMethod).toEqual({
      CASH: '30.00',
      CARD: '20.00',
      TRANSFER: '0.00',
      OTHER: '0.00',
    });
    expect(report.byUser).toEqual([
      { userId: 'user-1', name: 'Caja Uno', total: '30.00' },
      { userId: 'user-2', name: 'Caja Dos', total: '20.00' },
    ]);
    expect(report.payments).toMatchObject({ page: 1, total: 2 });
    expect(report.payments.items.map((row) => row.contractNumber)).toEqual([733, 734]);
    expect(report.voided).toHaveLength(1);
    expect(report.voided[0]).toMatchObject({ amount: '5.00', customerName: 'Luis Gómez' });

    expect((await cash.report(cashQuerySchema.parse({ date: '2026-09-30' }))).total).toBe('1.00');

    // La página no cambia las sumas del día (101).
    const second = await cash.report(cashQuerySchema.parse({ page: '2', pageSize: '1' }));
    expect(second.total).toBe('50.00');
    expect(second.payments).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(second.payments.items.map((row) => row.contractNumber)).toEqual([734]);
  });

  it('depósitos en custodia y cuentas por cobrar (RN-2, RN-3)', async () => {
    const { store, payments, cash } = setup();
    store.add(agreementRecord({ id: 'r1', status: 'RESERVED', deposit: '100.00' }));
    store.add(agreementRecord({ id: 'f1', status: 'FINISHED', contractNumber: 700 }));
    store.add(agreementRecord({ id: 'x1', status: 'CANCELLED' }));
    await payments.addPayment('a1', { amount: '50.00', method: 'CASH' }, ACTOR);

    const deposits = await cash.depositsHeld(PAGE);
    const receivables = await cash.receivables(PAGE);

    expect(deposits).toMatchObject({ total: 1, totalAmount: '100.00' });
    expect(deposits.items).toEqual([
      { agreementId: 'r1', contractNumber: null, customer: 'Ana Pérez', amount: '100.00' },
    ]);
    expect(receivables).toMatchObject({ total: 1, totalBalance: '50.00' });
    expect(receivables.items).toEqual([
      {
        agreementId: 'f1',
        contractNumber: 700,
        customer: 'Ana Pérez',
        total: '50.00',
        paid: '0.00',
        balance: '50.00',
        status: 'FINISHED',
      },
    ]);
  });

  it('las cuentas por cobrar paginan y el total sigue siendo de todas (101)', async () => {
    const { store, cash } = setup();
    store.add(agreementRecord({ id: 'f1', status: 'FINISHED', contractNumber: 700 }));
    store.add(agreementRecord({ id: 'f2', status: 'FINISHED', contractNumber: 701 }));

    const second = await cash.receivables({ page: 2, pageSize: 1 });

    // a1 (en curso), f1 y f2 deben 50 cada una: empatan y desempata el id.
    expect(second).toMatchObject({ page: 2, pageSize: 1, total: 3, totalBalance: '150.00' });
    expect(second.items.map((row) => row.agreementId)).toEqual(['f1']);
  });
});

describe('RentalPaymentUseCases.listPayments (101)', () => {
  it('pagina los pagos de una renta, el último primero', async () => {
    const { payments } = setup();
    await payments.addPayment(
      'a1',
      { amount: '10.00', method: 'CASH', paidAt: '2026-10-01T15:00:00Z' },
      ACTOR,
    );
    await payments.addPayment(
      'a1',
      { amount: '20.00', method: 'CASH', paidAt: '2026-10-01T16:00:00Z' },
      ACTOR,
    );

    const first = await payments.listPayments('a1', { page: 1, pageSize: 1 });

    expect(first).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(first.items.map((row) => row.amount)).toEqual(['20.00']);
    expect(first.items[0]?.receivedByName).toBe('Caja Uno');
  });

  it('404 si la renta no existe', async () => {
    const { payments } = setup();

    expect(await rejection(payments.listPayments('nope', PAGE))).toBeInstanceOf(NotFoundError);
  });
});
