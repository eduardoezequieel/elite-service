import { API_ERROR_CODES } from '@elite/shared';
import type { CarwashEventActor, CreateChargeInput, Ticket } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { ChargeUseCases } from './charge.usecases';
import type { CashSessionRecord } from './ports/cash-session.repository';
import type { TicketRepository } from './ports/ticket.repository';
import {
  FakePriceAuthorizer,
  PRICE_BOSS,
  PRICE_BOSS_CREDENTIALS,
} from './testing/fake-price-authorizer';
import { InMemoryChargeRepository, InMemoryTickets } from './testing/in-memory-charge.repository';
import { InMemoryTicketEvents } from './testing/in-memory-ticket-events';
import { InMemoryLowStockEvents, InMemoryStock } from './testing/in-memory-ticket.repository';
import { FakeCashSessions, readyTicket } from './testing/ready-ticket';

const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana' };

/** Un lavado de $20 de servicio + 2 ceras de $3 puestas en el lavado (065). */
function washWithProduct(id: string): Ticket {
  const base = readyTicket(id, '20.00');

  return {
    ...base,
    total: '26.00',
    items: [
      ...base.items,
      {
        ...base.items[0],
        id: `p-${id}`,
        kind: 'PRODUCT',
        serviceId: null,
        inventoryItemId: 'wax',
        code: 'INV-0001',
        name: 'Cera en pasta',
        catalogPrice: '3.00',
        unitPrice: '3.00',
        quantity: '2.000',
        total: '6.00',
        sortOrder: 1,
      },
    ],
  };
}

function build() {
  const stock = new InMemoryStock();

  stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 5000 });
  stock.add({ id: 'scent', name: 'Aromatizante', price: 150, onHand: 10_000 });

  const tickets = new InMemoryTickets([
    readyTicket('t1', '14.00'),
    readyTicket('t2', '10.00'),
    washWithProduct('t3'),
  ]);
  const charges = new InMemoryChargeRepository(tickets, stock);
  const events = new InMemoryTicketEvents();
  const lowStock = new InMemoryLowStockEvents();
  const cash = new FakeCashSessions({ id: 'cash-1' } as CashSessionRecord);
  const usecases = new ChargeUseCases(
    charges,
    tickets as unknown as TicketRepository,
    cash,
    events,
    stock,
    new FakePriceAuthorizer(),
    lowStock,
  );

  return { stock, tickets, charges, events, lowStock, usecases };
}

/** 2 lavados ($14 + $10) + 1 cera ($3): cuenta de $27 con pago partido. */
const joint: CreateChargeInput = {
  workOrderIds: ['t1', 't2'],
  products: [{ inventoryItemId: 'wax', quantity: '1.000' }],
  payments: [
    { method: 'CARD', amount: '20.00' },
    { method: 'CASH', amount: '7.00' },
  ],
  cashTendered: '10.00',
};

describe('ChargeUseCases — lavados y productos sueltos en una cuenta (066)', () => {
  it('cobra los lavados y la venta en la misma cuenta', async () => {
    const { usecases, tickets, stock } = build();

    const charge = await usecases.create(joint, ana.id, ana);

    expect(charge).toMatchObject({
      number: 'C-0001',
      total: '27.00',
      cashTendered: '10.00',
      changeGiven: '3.00',
      counterSale: {
        number: 'V-0001',
        total: '3.00',
        items: [{ name: 'Cera en pasta', quantity: '1.000', unitPrice: '3.00', total: '3.00' }],
      },
    });
    expect(charge.tickets.map((ticket) => ticket.status)).toEqual(['PAID', 'PAID']);
    expect(tickets.get('t1')?.charge).toMatchObject({
      ticketCount: 2,
      counterSale: { number: 'V-0001' },
    });
    expect(charge.payments.map((line) => [line.method, line.amount])).toEqual([
      ['CARD', '20.00'],
      ['CASH', '7.00'],
    ]);
    expect(stock.onHand('wax')).toBe(4000);
  });

  it('reparte cada renglón entre los lavados y la venta, al centavo (059 RN-5)', async () => {
    const { usecases, charges } = build();

    await usecases.create(joint, ana.id);

    const written = charges.lastCreated;

    expect(written?.tickets.map((ticket) => ticket.payments.map((line) => line.amount))).toEqual([
      [1037, 363],
      [741, 259],
    ]);
    expect(written?.sale?.payments.map((line) => [line.method, line.amount])).toEqual([
      ['CARD', 222],
      ['CASH', 78],
    ]);
    expect(written?.sale?.total).toBe(300);
  });

  it('la comisión sale solo de los servicios de los lavados', async () => {
    const { usecases, charges } = build();

    await usecases.create(
      {
        workOrderIds: ['t3'],
        products: [{ inventoryItemId: 'scent', quantity: '2.000' }],
        payments: [{ method: 'CASH', amount: '29.00' }],
      },
      ana.id,
    );

    // $20 de servicio → tramo de $2; ni la cera del lavado ni la venta suman.
    expect(charges.lastCreated?.tickets[0]?.commissionTotal).toBe(200);
    expect(charges.lastCreated?.total).toBe(2900);
  });

  it('una cuenta sin lavados ni productos es 422 VALIDATION_ERROR', async () => {
    const { usecases, charges } = build();

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: [], products: [], payments: [{ method: 'CASH', amount: '1.00' }] },
        ana.id,
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    expect(charges.lastCreated).toBeNull();
  });

  it('el total incluye la venta: pagar solo los lavados no cuadra', async () => {
    const { usecases } = build();

    const failure = await captureApiError(
      usecases.create({ ...joint, payments: [{ method: 'CASH', amount: '24.00' }] }, ana.id),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH);
    expect(failure.body.details).toEqual({ total: '27.00', amount: '24.00' });
  });

  it('si un producto no alcanza no se cobra nada, tampoco los lavados (RN-7)', async () => {
    const { usecases, tickets, stock } = build();

    const failure = await captureApiError(
      usecases.create(
        {
          ...joint,
          products: [{ inventoryItemId: 'wax', quantity: '6.000' }],
          payments: [{ method: 'CASH', amount: '42.00' }],
          cashTendered: undefined,
        },
        ana.id,
      ),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.INSUFFICIENT_STOCK);
    expect(tickets.get('t1')?.status).toBe('READY');
    expect(stock.onHand('wax')).toBe(5000);
  });

  it('un precio rebajado pide la firma de la 060 también desde el lavado', async () => {
    const { usecases } = build();
    const discounted: CreateChargeInput = {
      workOrderIds: ['t1'],
      products: [{ inventoryItemId: 'wax', quantity: '1.000', unitPrice: '2.50' }],
      payments: [{ method: 'CASH', amount: '16.50' }],
    };

    const missing = await captureApiError(usecases.create(discounted, ana.id));
    const charge = await usecases.create(
      {
        ...discounted,
        priceAuthorization: { reason: 'Cliente frecuente', authorization: PRICE_BOSS_CREDENTIALS },
      },
      ana.id,
    );

    expect(missing.body.code).toBe(API_ERROR_CODES.PRICE_CHANGE_NOT_AUTHORIZED);
    expect(charge.counterSale?.total).toBe('2.50');
  });

  it('publica el aviso de mínimo después de cobrar', async () => {
    const { usecases, stock, lowStock } = build();

    stock.add({ id: 'wax', name: 'Cera en pasta', price: 300, onHand: 5000, minStock: 4000 });

    await usecases.create(joint, ana.id, ana);

    expect(lowStock.published).toEqual([
      expect.objectContaining({ itemId: 'wax', stockOnHand: '4.000', actor: ana }),
    ]);
  });

  describe('anular la cuenta entera (059 RN-8, 066)', () => {
    it('desde el lavado: vuelve a listo con sus productos y la venta queda anulada', async () => {
      const { usecases, tickets, stock, charges } = build();
      const charge = await usecases.create(
        {
          workOrderIds: ['t3'],
          products: [{ inventoryItemId: 'scent', quantity: '2.000' }],
          payments: [{ method: 'CASH', amount: '29.00' }],
        },
        ana.id,
      );
      const paid = tickets.get('t3');

      if (paid === undefined || charge.counterSale === null) throw new Error('missing account');

      // Un solo lavado + la venta: se deshace desde el lavado, y la venta con él.
      const [reversed] = await usecases.voidForTicket(paid, 'Se cobró mal', ana, PRICE_BOSS);

      expect(reversed.status).toBe('READY');
      expect(reversed.items.map((item) => item.kind)).toEqual(['SERVICE', 'PRODUCT']);
      expect(charges.sales.get(charge.counterSale.id)?.sale).toMatchObject({
        status: 'VOID',
        voidReason: 'Se cobró mal',
        voidedBy: { id: PRICE_BOSS.id },
      });
      // La cera del lavado no se mueve; el aromatizante de la venta vuelve.
      expect(stock.onHand('scent')).toBe(10_000);
      expect(stock.movements.map((movement) => [movement.itemId, movement.type])).toEqual([
        ['scent', 'SALE'],
        ['scent', 'SALE_RETURN'],
      ]);
    });

    it('con dos lavados, uno suelto no se deshace: se deshace la cuenta', async () => {
      const { usecases, tickets, stock } = build();
      const charge = await usecases.create(joint, ana.id);
      const paid = tickets.get('t1');

      if (paid === undefined) throw new Error('missing ticket');

      const failure = await captureApiError(usecases.voidForTicket(paid, 'Se cobró mal'));
      const voided = await usecases.voidAccount(
        charge.id,
        { reason: 'Se cobró mal', authorizer: PRICE_BOSS },
        ana,
      );

      expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_NOT_REVERSIBLE);
      expect(voided.tickets.map((ticket) => ticket.status)).toEqual(['READY', 'READY']);
      expect(voided.counterSaleId).toBe(charge.counterSale?.id);
      expect(stock.onHand('wax')).toBe(5000);
    });
  });
});
