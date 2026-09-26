import { API_ERROR_CODES } from '@elite/shared';
import type { CarwashEventActor, CreateCounterSaleInput } from '@elite/shared';

import { ChargeUseCases } from '../../carwash/application/charge.usecases';
import type { CashSessionRecord } from '../../carwash/application/ports/cash-session.repository';
import type { TicketRepository } from '../../carwash/application/ports/ticket.repository';
import {
  FakePriceAuthorizer,
  PRICE_BOSS as boss,
  PRICE_BOSS_CREDENTIALS as credentials,
} from '../../carwash/application/testing/fake-price-authorizer';
import {
  InMemoryChargeRepository,
  InMemoryTickets,
} from '../../carwash/application/testing/in-memory-charge.repository';
import { InMemoryTicketEvents } from '../../carwash/application/testing/in-memory-ticket-events';
import {
  InMemoryLowStockEvents,
  InMemoryStock,
} from '../../carwash/application/testing/in-memory-ticket.repository';
import { FakeCashSessions, readyTicket } from '../../carwash/application/testing/ready-ticket';
import { ItemInactiveError } from '../../inventory/domain/stock';
import { captureApiError } from '../../users/application/testing/capture-api-error';
import { CounterSaleUseCases } from './counter-sale.usecases';
import { InMemoryCounterSaleRepository } from './testing/in-memory-counter-sale.repository';

const cashier: CarwashEventActor = { kind: 'user', id: 'u-cashier', name: 'Caja Uno' };

/**
 * La venta sobre la cuenta real en memoria (066): vender es cobrar una cuenta
 * sin lavados, asi que estos tests pasan por `ChargeUseCases` y su kardex.
 */
function setup() {
  const stock = new InMemoryStock();

  stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 3000 });
  stock.add({ id: 'scent', name: 'Aromatizante', price: 150, onHand: 10_000 });
  stock.add({ id: 'rags', name: 'Franelas', kind: 'SUPPLY', price: 0, onHand: 50_000 });

  const tickets = new InMemoryTickets([readyTicket('t7', '14.00'), readyTicket('t8', '10.00')]);
  const charges = new InMemoryChargeRepository(tickets, stock);
  const cash = new FakeCashSessions({ id: 'cash-1' } as CashSessionRecord);
  const authorizer = new FakePriceAuthorizer();
  const lowStock = new InMemoryLowStockEvents();
  const events = new InMemoryTicketEvents();
  const accounts = new ChargeUseCases(
    charges,
    tickets as unknown as TicketRepository,
    cash,
    events,
    stock,
    authorizer,
    lowStock,
  );

  charges.users.set(cashier.id, cashier.name);
  charges.users.set(boss.id, boss.fullName);

  return {
    stock,
    tickets,
    charges,
    cash,
    authorizer,
    lowStock,
    events,
    accounts,
    sales: new CounterSaleUseCases(new InMemoryCounterSaleRepository(charges, cash), accounts),
  };
}

function saleInput(overrides: Partial<CreateCounterSaleInput> = {}): CreateCounterSaleInput {
  return {
    items: [
      { inventoryItemId: 'wax', quantity: '2.000' },
      { inventoryItemId: 'scent', quantity: '1.000' },
    ],
    payments: [{ method: 'CASH', amount: '7.50' }],
    ...overrides,
  };
}

describe('CounterSaleUseCases.create', () => {
  it('sells, charges and takes the stock out in one go (RN-18, RN-19, RN-20)', async () => {
    const { stock, sales } = setup();

    const sale = await sales.create(
      saleInput({
        customerName: 'Juan',
        payments: [
          { method: 'CARD', amount: '5.00' },
          { method: 'CASH', amount: '2.50' },
        ],
        cashTendered: '5.00',
      }),
      cashier.id,
    );

    expect(sale).toMatchObject({
      number: 'V-0001',
      status: 'PAID',
      customerName: 'Juan',
      total: '7.50',
      cashTendered: '5.00',
      changeGiven: '2.50',
      charge: { number: 'C-0001' },
      accountTickets: [],
      createdBy: { id: cashier.id, fullName: cashier.name },
      isVoidable: true,
    });
    expect(
      sale.items.map((item) => [item.code, item.quantity, item.unitPrice, item.total]),
    ).toEqual([
      ['INV-0001', '2.000', '3.00', '6.00'],
      ['INV-0002', '1.000', '1.50', '1.50'],
    ]);
    expect(stock.onHand('wax')).toBe(1000);
    expect(stock.onHand('scent')).toBe(9000);
    expect(
      stock.movements.map((movement) => ({
        itemId: movement.itemId,
        type: movement.type,
        quantity: movement.quantity,
        counterSaleId: movement.counterSaleId,
        workOrderId: movement.workOrderId,
        createdByUserId: movement.createdByUserId,
      })),
    ).toEqual([
      {
        itemId: 'wax',
        type: 'SALE',
        quantity: -2000,
        counterSaleId: sale.id,
        workOrderId: null,
        createdByUserId: cashier.id,
      },
      {
        itemId: 'scent',
        type: 'SALE',
        quantity: -1000,
        counterSaleId: sale.id,
        workOrderId: null,
        createdByUserId: cashier.id,
      },
    ]);
    // Una cuenta sin lavados: toda la plata es de la venta, un renglon por metodo.
    expect(sale.payments.map((payment) => [payment.method, payment.amount])).toEqual([
      ['CARD', '5.00'],
      ['CASH', '2.50'],
    ]);
  });

  it('stores a blank customer name as null', async () => {
    const { sales } = setup();

    const sale = await sales.create(saleInput({ customerName: '' }), cashier.id);

    expect(sale.customerName).toBeNull();
  });

  it('numbers sales correlatively', async () => {
    const { sales } = setup();
    const input = saleInput({
      items: [{ inventoryItemId: 'scent', quantity: '1.000' }],
      payments: [{ method: 'CASH', amount: '1.50' }],
    });

    await sales.create(input, cashier.id);
    const second = await sales.create(input, cashier.id);

    expect(second.number).toBe('V-0002');
  });

  it('fails the whole sale with 409 INSUFFICIENT_STOCK and charges nothing (RN-19)', async () => {
    const { stock, charges, sales } = setup();

    const error = await captureApiError(
      sales.create(
        saleInput({
          items: [
            { inventoryItemId: 'scent', quantity: '1.000' },
            { inventoryItemId: 'wax', quantity: '4.000' },
          ],
          payments: [{ method: 'CASH', amount: '13.50' }],
        }),
        cashier.id,
      ),
    );

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.INSUFFICIENT_STOCK);
    expect(error.body.details).toEqual({ itemId: 'wax', available: '3.000' });
    expect(stock.onHand('scent')).toBe(10_000);
    expect(stock.movements).toHaveLength(0);
    expect(charges.sales.size).toBe(0);
  });

  it('rejects a supply with 409 ITEM_NOT_SELLABLE (RN-21)', async () => {
    const { sales } = setup();

    const error = await captureApiError(
      sales.create(
        saleInput({ items: [{ inventoryItemId: 'rags', quantity: '1.000', unitPrice: '0.00' }] }),
        cashier.id,
      ),
    );

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.ITEM_NOT_SELLABLE);
  });

  it('rejects an inactive product with 409 ITEM_INACTIVE (RN-21)', async () => {
    const { stock, sales } = setup();

    stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 3000, isActive: false });

    const error = await captureApiError(sales.create(saleInput(), cashier.id));

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.ITEM_INACTIVE);
  });

  it('answers 404 for an unknown product', async () => {
    const { sales } = setup();

    const error = await captureApiError(
      sales.create(
        saleInput({ items: [{ inventoryItemId: 'ghost', quantity: '1.000' }] }),
        cashier.id,
      ),
    );

    expect(error.status).toBe(404);
  });

  it('translates stock errors raised inside the transaction', async () => {
    const { charges, sales } = setup();

    charges.failNextCreate = new ItemInactiveError('wax');

    const error = await captureApiError(sales.create(saleInput(), cashier.id));

    expect(error.body.code).toBe(API_ERROR_CODES.ITEM_INACTIVE);
  });

  it('rejects a price above the item with 422 PRICE_ABOVE_CATALOG', async () => {
    const { sales } = setup();

    const error = await captureApiError(
      sales.create(
        saleInput({
          items: [{ inventoryItemId: 'wax', quantity: '1.000', unitPrice: '3.01' }],
          payments: [{ method: 'CASH', amount: '3.01' }],
        }),
        cashier.id,
      ),
    );

    expect(error.status).toBe(422);
    expect(error.body.code).toBe(API_ERROR_CODES.PRICE_ABOVE_CATALOG);
  });

  describe('lower price (RN-21, 060)', () => {
    const discounted = {
      items: [
        { inventoryItemId: 'wax', quantity: '1.000', unitPrice: '2.00' },
        { inventoryItemId: 'scent', quantity: '1.000' },
      ],
      payments: [{ method: 'CASH' as const, amount: '3.50' }],
    };

    it('asks for the authorization when it is missing', async () => {
      const { stock, sales } = setup();

      const error = await captureApiError(sales.create(saleInput(discounted), cashier.id));

      expect(error.status).toBe(422);
      expect(error.body.code).toBe(API_ERROR_CODES.PRICE_CHANGE_NOT_AUTHORIZED);
      expect(stock.movements).toHaveLength(0);
    });

    it('verifies the credentials against carwash.discount and signs only the lowered line', async () => {
      const { authorizer, sales } = setup();

      const sale = await sales.create(
        saleInput({
          ...discounted,
          priceAuthorization: { reason: 'Cliente frecuente', authorization: credentials },
        }),
        cashier.id,
      );

      expect(authorizer.calls).toEqual([
        { email: credentials.email, required: ['carwash.discount'] },
      ]);
      expect(sale.total).toBe('3.50');
      expect(sale.items[0]).toMatchObject({
        unitPrice: '2.00',
        catalogPrice: '3.00',
        priceAuthorizedBy: { id: boss.id, fullName: boss.fullName },
        priceReason: 'Cliente frecuente',
      });
      expect(sale.items[1]).toMatchObject({ priceAuthorizedBy: null, priceReason: null });
    });

    it('fails with 403 AUTHORIZATION_FAILED on bad credentials and sells nothing', async () => {
      const { stock, sales } = setup();

      const error = await captureApiError(
        sales.create(
          saleInput({
            ...discounted,
            priceAuthorization: {
              reason: 'Cliente frecuente',
              authorization: { ...credentials, password: 'nope' },
            },
          }),
          cashier.id,
        ),
      );

      expect(error.status).toBe(403);
      expect(error.body.code).toBe(API_ERROR_CODES.AUTHORIZATION_FAILED);
      expect(stock.movements).toHaveLength(0);
    });

    it('ignores an authorization nobody needs', async () => {
      const { authorizer, sales } = setup();

      const sale = await sales.create(
        saleInput({ priceAuthorization: { reason: 'x', authorization: credentials } }),
        cashier.id,
      );

      expect(authorizer.calls).toHaveLength(0);
      expect(sale.items.every((item) => item.priceAuthorizedBy === null)).toBe(true);
    });
  });

  describe('payment (059)', () => {
    it('rejects payments that do not add up with 422 PAYMENT_AMOUNT_MISMATCH', async () => {
      const { sales } = setup();

      const error = await captureApiError(
        sales.create(saleInput({ payments: [{ method: 'CASH', amount: '7.00' }] }), cashier.id),
      );

      expect(error.status).toBe(422);
      expect(error.body.code).toBe(API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH);
      expect(error.body.details).toEqual({ total: '7.50', amount: '7.00' });
    });

    it('rejects a zero-total sale', async () => {
      const { sales } = setup();

      const error = await captureApiError(
        sales.create(
          saleInput({
            items: [{ inventoryItemId: 'scent', quantity: '1.000', unitPrice: '0.00' }],
            payments: [{ method: 'CASH', amount: '0.00' }],
            priceAuthorization: { reason: 'Regalo', authorization: credentials },
          }),
          cashier.id,
        ),
      );

      expect(error.body.code).toBe(API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH);
    });

    it('rejects short cash with 422 CASH_TENDERED_SHORT', async () => {
      const { sales } = setup();

      const error = await captureApiError(
        sales.create(saleInput({ cashTendered: '5.00' }), cashier.id),
      );

      expect(error.status).toBe(422);
      expect(error.body.code).toBe(API_ERROR_CODES.CASH_TENDERED_SHORT);
    });

    it('answers 409 CASH_NOT_OPEN without an open cash session', async () => {
      const { cash, stock, sales } = setup();

      cash.current = null;

      const error = await captureApiError(sales.create(saleInput(), cashier.id));

      expect(error.status).toBe(409);
      expect(error.body.code).toBe(API_ERROR_CODES.CASH_NOT_OPEN);
      expect(stock.movements).toHaveLength(0);
    });
  });

  it('publishes the low-stock notice after the sale, with the actor', async () => {
    const { stock, lowStock, sales } = setup();

    stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 3000, minStock: 1000 });

    await sales.create(saleInput(), cashier.id, cashier);

    expect(lowStock.published).toEqual([
      expect.objectContaining({
        itemId: 'wax',
        stockOnHand: '1.000',
        minStock: '1.000',
        actor: cashier,
      }),
    ]);
  });
});

describe('CounterSaleUseCases.voidById', () => {
  const voidInput = { reason: 'Se equivocó de producto', authorization: credentials };

  it('voids the sale, takes the payments out and returns the stock (RN-22)', async () => {
    const { stock, sales } = setup();
    const sale = await sales.create(saleInput(), cashier.id);

    const voided = await sales.voidById(sale.id, voidInput, boss, cashier);

    expect(voided).toMatchObject({
      status: 'VOID',
      payments: [],
      charge: null,
      voidedBy: { id: boss.id, fullName: boss.fullName },
      voidReason: 'Se equivocó de producto',
      isVoidable: false,
    });
    expect(voided.voidedAt).not.toBeNull();
    expect(stock.onHand('wax')).toBe(3000);
    expect(stock.onHand('scent')).toBe(10_000);
    expect(
      stock.movements
        .filter((movement) => movement.type === 'SALE_RETURN')
        .map((movement) => [
          movement.itemId,
          movement.quantity,
          movement.counterSaleId,
          movement.createdByUserId,
        ]),
    ).toEqual([
      ['wax', 2000, sale.id, cashier.id],
      ['scent', 1000, sale.id, cashier.id],
    ]);
  });

  it('answers 409 SALE_ALREADY_VOID the second time', async () => {
    const { sales } = setup();
    const sale = await sales.create(saleInput(), cashier.id);

    await sales.voidById(sale.id, voidInput, boss);
    const error = await captureApiError(sales.voidById(sale.id, voidInput, boss));

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.SALE_ALREADY_VOID);
  });

  it('answers 409 CASH_SESSION_GONE when the cash session was closed', async () => {
    const { cash, sales } = setup();
    const sale = await sales.create(saleInput(), cashier.id);

    cash.current = null;
    const closed = await captureApiError(sales.voidById(sale.id, voidInput, boss));

    cash.current = { id: 'cash-2' } as CashSessionRecord;
    const another = await captureApiError(sales.voidById(sale.id, voidInput, boss));

    expect(closed.body.code).toBe(API_ERROR_CODES.CASH_SESSION_GONE);
    expect(another.status).toBe(409);
    expect(another.body.code).toBe(API_ERROR_CODES.CASH_SESSION_GONE);
    expect((await sales.findById(sale.id)).payments).toHaveLength(1);
  });

  it('reads isVoidable: only a paid sale of the open shift (RN-22)', async () => {
    const { cash, sales } = setup();
    const sale = await sales.create(saleInput(), cashier.id);

    expect(sale.isVoidable).toBe(true);

    cash.current = { id: 'cash-2' } as CashSessionRecord;
    expect((await sales.findById(sale.id)).isVoidable).toBe(false);

    cash.current = { id: 'cash-1' } as CashSessionRecord;
    const voided = await sales.voidById(sale.id, voidInput, boss);
    expect(voided.isVoidable).toBe(false);
  });

  it('answers 404 for an unknown sale', async () => {
    const { sales } = setup();

    const error = await captureApiError(sales.voidById('ghost', voidInput, boss));

    expect(error.status).toBe(404);
  });
});

describe('una sola cuenta: lavados y productos (066)', () => {
  const voidInput = { reason: 'Se cobró mal', authorization: credentials };

  /** Dos lavados ($14 y $10) y 1 cera ($3) en una cuenta, con pago partido. */
  async function account() {
    const context = setup();
    const charge = await context.accounts.create(
      {
        workOrderIds: ['t7', 't8'],
        products: [{ inventoryItemId: 'wax', quantity: '1.000' }],
        payments: [
          { method: 'CARD', amount: '20.00' },
          { method: 'CASH', amount: '7.00' },
        ],
      },
      cashier.id,
      cashier,
    );

    if (charge.counterSale === null) throw new Error('missing sale');

    return { ...context, charge, saleId: charge.counterSale.id };
  }

  it('la venta dice con qué lavados se cobró', async () => {
    const { sales, saleId } = await account();

    const sale = await sales.findById(saleId);

    expect(sale.accountTickets).toEqual([
      { id: 't7', number: 'CW-0007' },
      { id: 't8', number: 'CW-0008' },
    ]);
    // Lo que le toco a la venta del reparto (RN-5), no el total de la cuenta.
    expect(sale.payments.map((payment) => [payment.method, payment.amount])).toEqual([
      ['CARD', '2.22'],
      ['CASH', '0.78'],
    ]);
  });

  it('anular la venta deshace la cuenta entera: los lavados vuelven a listo', async () => {
    const { sales, tickets, stock, events, saleId } = await account();

    events.published.length = 0;

    const voided = await sales.voidById(saleId, voidInput, boss, cashier);

    expect(voided).toMatchObject({ status: 'VOID', accountTickets: [], charge: null });
    expect(tickets.get('t7')).toMatchObject({ status: 'READY', payments: [], charge: null });
    expect(tickets.get('t8')?.status).toBe('READY');
    expect(tickets.get('t7')?.notes).toBe('Reverso: Se cobró mal (autorizó: Don Beto)');
    expect(stock.onHand('wax')).toBe(3000);
    expect(events.types).toEqual(['ticket.reversed', 'ticket.reversed']);
  });

  it('deshacer desde un lavado anula también la venta (059 RN-8)', async () => {
    const { accounts, sales, stock, charge, saleId } = await account();

    const reversed = await accounts.voidById(charge.id, voidInput, cashier, boss);

    expect(reversed.map((ticket) => ticket.status)).toEqual(['READY', 'READY']);
    expect(await sales.findById(saleId)).toMatchObject({
      status: 'VOID',
      voidedBy: { id: boss.id, fullName: boss.fullName },
      voidReason: 'Se cobró mal',
    });
    expect(stock.onHand('wax')).toBe(3000);
  });
});

describe('CounterSaleUseCases list and get', () => {
  it('lists the day newest first, filters by status and pages', async () => {
    const { charges, sales } = setup();
    const input = saleInput({
      items: [{ inventoryItemId: 'scent', quantity: '1.000' }],
      payments: [{ method: 'CASH', amount: '1.50' }],
    });

    const first = await sales.create(input, cashier.id);
    await sales.create(input, cashier.id);
    await sales.voidById(first.id, { reason: 'Error', authorization: credentials }, boss);
    charges.today = '2026-09-27';
    await sales.create(input, cashier.id);

    const day = await sales.list({ date: '2026-09-26', page: 1, pageSize: 25 });
    const paid = await sales.list({ date: '2026-09-26', status: 'PAID', page: 1, pageSize: 25 });
    const paged = await sales.list({ date: '2026-09-26', page: 2, pageSize: 1 });

    expect(day.items.map((sale) => sale.number)).toEqual(['V-0002', 'V-0001']);
    expect(day.total).toBe(2);
    expect(paid.items.map((sale) => sale.number)).toEqual(['V-0002']);
    expect(paged).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(paged.items.map((sale) => sale.number)).toEqual(['V-0001']);
  });

  it('gets one sale or answers 404', async () => {
    const { sales } = setup();
    const sale = await sales.create(saleInput(), cashier.id);

    await expect(sales.findById(sale.id)).resolves.toMatchObject({ number: 'V-0001' });
    expect((await captureApiError(sales.findById('ghost'))).status).toBe(404);
  });
});
