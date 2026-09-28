import { API_ERROR_CODES } from '@elite/shared';
import type { CarwashEventActor, CreateChargeInput } from '@elite/shared';

import { CounterSaleUseCases } from '../../sales/application/counter-sale.usecases';
import { InMemoryCounterSaleRepository } from '../../sales/application/testing/in-memory-counter-sale.repository';
import { captureApiError } from '../../users/application/testing/capture-api-error';
import { ChargeUseCases } from './charge.usecases';
import type { CashSessionRecord } from './ports/cash-session.repository';
import { BankAccountUnavailableError } from './ports/charge.repository';
import type { TicketRepository } from './ports/ticket.repository';
import { FakePriceAuthorizer } from './testing/fake-price-authorizer';
import type { InMemoryBankAccount } from './testing/in-memory-bank-account-directory';
import { InMemoryChargeRepository, InMemoryTickets } from './testing/in-memory-charge.repository';
import { InMemoryTicketEvents } from './testing/in-memory-ticket-events';
import { InMemoryLowStockEvents, InMemoryStock } from './testing/in-memory-ticket.repository';
import { FakeCashSessions, readyTicket } from './testing/ready-ticket';

const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana' };

const AGRICOLA: InMemoryBankAccount = {
  id: 'acc-agricola',
  bank: 'AGRICOLA',
  bankName: 'Banco Agrícola',
  type: 'CHECKING',
  number: '0012345678',
  active: true,
};

const BAC_OFF: InMemoryBankAccount = {
  id: 'acc-bac',
  bank: 'BAC',
  bankName: 'BAC Credomatic',
  type: 'SAVINGS',
  number: '99887766',
  active: false,
};

function build() {
  const stock = new InMemoryStock();

  stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 5000 });

  const tickets = new InMemoryTickets([readyTicket('t1', '14.00'), readyTicket('t2', '10.00')]);
  const charges = new InMemoryChargeRepository(tickets, stock);
  const cash = new FakeCashSessions({ id: 'cash-1' } as CashSessionRecord);

  charges.bankAccounts.add({ ...AGRICOLA });
  charges.bankAccounts.add({ ...BAC_OFF });

  const usecases = new ChargeUseCases(
    charges,
    tickets as unknown as TicketRepository,
    cash,
    new InMemoryTicketEvents(),
    stock,
    new FakePriceAuthorizer(),
    new InMemoryLowStockEvents(),
    charges.bankAccounts,
  );
  const sales = new CounterSaleUseCases(new InMemoryCounterSaleRepository(charges, cash), usecases);

  return { stock, tickets, charges, usecases, sales };
}

/** 2 lavados ($14 + $10) + 1 cera ($3) = $27: $20 por transferencia y $7 por «Otro». */
const joint: CreateChargeInput = {
  workOrderIds: ['t1', 't2'],
  products: [{ inventoryItemId: 'wax', quantity: '1.000' }],
  payments: [
    { method: 'TRANSFER', amount: '20.00', bankAccountId: AGRICOLA.id, reference: '998877' },
    { method: 'OTHER', amount: '7.00', description: 'cheque' },
  ],
};

const agricolaOnPayment = {
  id: AGRICOLA.id,
  bank: 'AGRICOLA',
  bankName: 'Banco Agrícola',
  type: 'CHECKING',
  number: '0012345678',
};

describe('ChargeUseCases — cuenta bancaria y «Otro» (069)', () => {
  it('cada parte de un renglón partido lleva la misma cuenta, referencia y descripción', async () => {
    const { usecases, charges } = build();

    await usecases.create(joint, ana.id, ana);

    const transfer = { bankAccountId: AGRICOLA.id, reference: '998877', description: null };
    const other = { bankAccountId: null, reference: null, description: 'cheque' };
    const written = charges.lastCreated;
    const parts = [...(written?.tickets.map((ticket) => ticket.payments) ?? [])];

    if (written?.sale) parts.push(written.sale.payments);

    expect(parts).toHaveLength(3);
    for (const lines of parts) {
      expect(lines.map((line) => [line.method, line.details])).toEqual([
        ['TRANSFER', transfer],
        ['OTHER', other],
      ]);
    }
  });

  it('el cobro, el lavado y la venta devuelven la cuenta y los datos del pago', async () => {
    const { usecases, sales } = build();

    const charge = await usecases.create(joint, ana.id, ana);

    expect(charge.payments).toEqual([
      expect.objectContaining({
        method: 'TRANSFER',
        amount: '20.00',
        bankAccount: agricolaOnPayment,
        reference: '998877',
        description: null,
      }),
      expect.objectContaining({
        method: 'OTHER',
        amount: '7.00',
        bankAccount: null,
        reference: null,
        description: 'cheque',
      }),
    ]);
    expect(charge.tickets[0].payments[0]).toMatchObject({
      method: 'TRANSFER',
      bankAccount: agricolaOnPayment,
      reference: '998877',
    });

    const saleId = charge.counterSale?.id ?? '';
    const sale = await sales.findById(saleId);

    expect(sale.payments[1]).toMatchObject({ method: 'OTHER', description: 'cheque' });
  });

  it('una cuenta inactiva es 422 BANK_ACCOUNT_UNAVAILABLE y no se cobra nada', async () => {
    const { usecases, charges, tickets, stock } = build();

    const failure = await captureApiError(
      usecases.create(
        {
          ...joint,
          payments: [
            { method: 'TRANSFER', amount: '20.00', bankAccountId: BAC_OFF.id, reference: '1' },
            { method: 'CASH', amount: '7.00' },
          ],
        },
        ana.id,
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE);
    expect(failure.body.details).toEqual({ bankAccountIds: [BAC_OFF.id] });
    expect(charges.lastCreated).toBeNull();
    expect(tickets.get('t1')?.status).toBe('READY');
    expect(stock.onHand('wax')).toBe(5000);
  });

  it('una cuenta que no existe tampoco se acepta', async () => {
    const { usecases, charges } = build();

    const failure = await captureApiError(
      usecases.create(
        {
          workOrderIds: ['t1'],
          payments: [
            { method: 'TRANSFER', amount: '14.00', bankAccountId: 'acc-nope', reference: '1' },
          ],
        },
        ana.id,
      ),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE);
    expect(charges.lastCreated).toBeNull();
  });

  it('una transferencia sin cuenta no se escribe, aunque llegue saltándose el schema (RN-8)', async () => {
    const { usecases, charges } = build();

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: ['t1'], payments: [{ method: 'TRANSFER', amount: '14.00' }] },
        ana.id,
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE);
    expect(charges.lastCreated).toBeNull();
  });

  it('si la cuenta se desactiva en plena escritura, 422 igual (carrera)', async () => {
    const { usecases, charges } = build();

    charges.failNextCreate = new BankAccountUnavailableError([AGRICOLA.id]);

    const failure = await captureApiError(
      usecases.create(
        {
          workOrderIds: ['t1'],
          payments: [
            { method: 'TRANSFER', amount: '14.00', bankAccountId: AGRICOLA.id, reference: '1' },
          ],
        },
        ana.id,
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE);
  });

  it('la venta suelta pasa por la misma validación (RN-8)', async () => {
    const { sales, stock } = build();

    const failure = await captureApiError(
      sales.create(
        {
          items: [{ inventoryItemId: 'wax', quantity: '1.000' }],
          payments: [
            { method: 'TRANSFER', amount: '3.00', bankAccountId: BAC_OFF.id, reference: '1' },
          ],
        },
        ana.id,
      ),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.BANK_ACCOUNT_UNAVAILABLE);
    expect(stock.onHand('wax')).toBe(5000);
  });
});
