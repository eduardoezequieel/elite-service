import { API_ERROR_CODES } from '@elite/shared';
import type { CarwashEventActor, Ticket } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { ChargeUseCases } from './charge.usecases';
import type { CashSessionRecord } from './ports/cash-session.repository';
import type { TicketRepository } from './ports/ticket.repository';
import { FakePriceAuthorizer } from './testing/fake-price-authorizer';
import { InMemoryChargeRepository, InMemoryTickets } from './testing/in-memory-charge.repository';
import { InMemoryTicketEvents } from './testing/in-memory-ticket-events';
import { InMemoryLowStockEvents, InMemoryStock } from './testing/in-memory-ticket.repository';
import { carlos, FakeCashSessions, readyTicket as ticket } from './testing/ready-ticket';

const ana: CarwashEventActor = { kind: 'user', id: 'u-ana', name: 'Ana' };
const jefe = { id: 'u-jefe', fullName: 'Jefe' };

function build(rows: Ticket[], cashOpen = true) {
  const tickets = new InMemoryTickets(rows);
  const charges = new InMemoryChargeRepository(tickets);
  const events = new InMemoryTicketEvents();
  const cashSessions = new FakeCashSessions(
    cashOpen ? ({ id: 'cash-1' } as CashSessionRecord) : null,
  );

  return {
    tickets,
    charges,
    events,
    usecases: new ChargeUseCases(
      charges,
      tickets as unknown as TicketRepository,
      cashSessions,
      events,
      new InMemoryStock(),
      new FakePriceAuthorizer(),
      new InMemoryLowStockEvents(),
      charges.bankAccounts,
    ),
  };
}

describe('ChargeUseCases.create — el caso normal (059 RN-1)', () => {
  it('un lavado y un pago dejan el lavado PAID con su cobro', async () => {
    const { usecases, tickets } = build([ticket('t1', '14.00')]);

    const charge = await usecases.create(
      { workOrderIds: ['t1'], payments: [{ method: 'CASH', amount: '14.00' }] },
      'u-ana',
    );

    expect(charge.number).toBe('C-0001');
    expect(charge.total).toBe('14.00');
    expect(charge.payments).toEqual([
      {
        id: 'line-1',
        method: 'CASH',
        amount: '14.00',
        bankAccount: null,
        reference: null,
        description: null,
      },
    ]);
    expect(tickets.get('t1')?.status).toBe('PAID');
  });

  it('congela la comisión de cada lavado por separado, no de la cuenta', async () => {
    const { usecases, charges } = build([ticket('t1', '14.00'), ticket('t2', '14.00')]);

    await usecases.create(
      { workOrderIds: ['t1', 't2'], payments: [{ method: 'CASH', amount: '28.00' }] },
      'u-ana',
    );

    expect(charges.lastCreated?.tickets.map((entry) => entry.commissionTotal)).toEqual([100, 100]);
    expect(charges.lastCreated?.tickets[0].entries).toEqual([
      { employeeId: carlos.id, amount: 100 },
    ]);
  });
});

describe('ChargeUseCases.create — reparto y cuadre (059 RN-3, RN-5)', () => {
  it('reparte dos métodos entre tres lavados y cada lavado recibe lo suyo', async () => {
    const { usecases, tickets } = build([
      ticket('t1', '2.00'),
      ticket('t2', '3.00'),
      ticket('t3', '5.00'),
    ]);

    const charge = await usecases.create(
      {
        workOrderIds: ['t1', 't2', 't3'],
        payments: [
          { method: 'CARD', amount: '6.00' },
          { method: 'CASH', amount: '4.00' },
        ],
      },
      'u-ana',
    );

    expect(charge.total).toBe('10.00');
    expect(tickets.get('t1')?.payments.map((payment) => payment.amount)).toEqual(['1.20', '0.80']);
    expect(tickets.get('t2')?.payments.map((payment) => payment.amount)).toEqual(['1.80', '1.20']);
    expect(tickets.get('t3')?.payments.map((payment) => payment.amount)).toEqual(['3.00', '2.00']);
  });

  it('con centavos que no dividen exacto, la suma sigue siendo el total', async () => {
    const { usecases, charges } = build([
      ticket('t1', '3.33'),
      ticket('t2', '3.33'),
      ticket('t3', '3.34'),
    ]);

    await usecases.create(
      { workOrderIds: ['t1', 't2', 't3'], payments: [{ method: 'CASH', amount: '10.00' }] },
      'u-ana',
    );

    const parts = charges.lastCreated?.tickets.flatMap((entry) =>
      entry.payments.map((payment) => payment.amount),
    );

    expect(parts?.reduce((sum, part) => sum + part, 0)).toBe(1000);
  });

  it('si los renglones no suman el total, no se cobra nada', async () => {
    const { usecases, tickets } = build([ticket('t1', '60.50')]);

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: ['t1'], payments: [{ method: 'CASH', amount: '59.00' }] },
        'u-ana',
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH);
    expect(tickets.get('t1')?.status).toBe('READY');
  });

  it('una cuenta en cero no se cobra: se anula como cortesía', async () => {
    const { usecases } = build([ticket('t1', '0.00')]);

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: ['t1'], payments: [{ method: 'CASH', amount: '0.00' }] },
        'u-ana',
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.PAYMENT_AMOUNT_MISMATCH);
  });
});

describe('ChargeUseCases.create — efectivo y vuelto (059 RN-10)', () => {
  it('$50.00 sobre $43.50 deja $6.50 de vuelto', async () => {
    const { usecases } = build([ticket('t1', '43.50')]);

    const charge = await usecases.create(
      {
        workOrderIds: ['t1'],
        payments: [{ method: 'CASH', amount: '43.50' }],
        cashTendered: '50.00',
      },
      'u-ana',
    );

    expect(charge.cashTendered).toBe('50.00');
    expect(charge.changeGiven).toBe('6.50');
  });

  it('lo entregado que no alcanza rechaza el cobro', async () => {
    const { usecases, tickets } = build([ticket('t1', '43.50')]);

    const failure = await captureApiError(
      usecases.create(
        {
          workOrderIds: ['t1'],
          payments: [{ method: 'CASH', amount: '43.50' }],
          cashTendered: '40.00',
        },
        'u-ana',
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.CASH_TENDERED_SHORT);
    expect(tickets.get('t1')?.status).toBe('READY');
  });

  it('sin nada en efectivo, lo entregado no se guarda', async () => {
    const { usecases } = build([ticket('t1', '43.50')]);

    const charge = await usecases.create(
      {
        workOrderIds: ['t1'],
        payments: [{ method: 'CARD', amount: '43.50' }],
        cashTendered: '50.00',
      },
      'u-ana',
    );

    expect(charge.cashTendered).toBeNull();
    expect(charge.changeGiven).toBeNull();
  });
});

describe('ChargeUseCases.create — lavados cobrables (059 RN-4, RN-7)', () => {
  it('un lavado ya cobrado tumba la cuenta entera', async () => {
    const { usecases, tickets } = build([
      ticket('t1', '14.00'),
      ticket('t2', '14.00', { status: 'PAID' }),
    ]);

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: ['t1', 't2'], payments: [{ method: 'CASH', amount: '28.00' }] },
        'u-ana',
      ),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_ALREADY_CHARGED);
    expect(tickets.get('t1')?.status).toBe('READY');
  });

  it('un lavado que todavía no está listo tampoco entra', async () => {
    const { usecases } = build([ticket('t1', '14.00'), ticket('t2', '14.00', { status: 'OPEN' })]);

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: ['t1', 't2'], payments: [{ method: 'CASH', amount: '28.00' }] },
        'u-ana',
      ),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_NOT_READY);
  });

  it('un lavado inexistente es 404', async () => {
    const { usecases } = build([ticket('t1', '14.00')]);

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: ['t9'], payments: [{ method: 'CASH', amount: '14.00' }] },
        'u-ana',
      ),
    );

    expect(failure.status).toBe(404);
  });

  it('sin turno de caja abierto no se cobra', async () => {
    const { usecases, charges } = build([ticket('t1', '14.00')], false);

    const failure = await captureApiError(
      usecases.create(
        { workOrderIds: ['t1'], payments: [{ method: 'CASH', amount: '14.00' }] },
        'u-ana',
      ),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.CASH_NOT_OPEN);
    expect(charges.lastCreated).toBeNull();
  });

  it('avisa una vez por lavado de la cuenta (042)', async () => {
    const { usecases, events } = build([ticket('t1', '14.00'), ticket('t2', '14.00')]);

    await usecases.create(
      { workOrderIds: ['t1', 't2'], payments: [{ method: 'CASH', amount: '28.00' }] },
      'u-ana',
      ana,
    );

    expect(events.types).toEqual(['ticket.charged', 'ticket.charged']);
    expect(events.last?.previousStatus).toBe('READY');
  });
});

describe('ChargeUseCases.voidById — deshacer es deshacer la cuenta (059 RN-8)', () => {
  const authorization = { email: 'jefe@taller.sv', password: 'x' };

  async function charged() {
    const context = build([ticket('t1', '10.00'), ticket('t2', '20.00')]);
    const charge = await context.usecases.create(
      { workOrderIds: ['t1', 't2'], payments: [{ method: 'CASH', amount: '30.00' }] },
      'u-ana',
      ana,
    );

    context.events.published.length = 0;

    return { ...context, charge };
  }

  it('los dos lavados vuelven a READY y sus pagos salen del turno', async () => {
    const { usecases, tickets, charge } = await charged();

    const reversed = await usecases.voidById(
      charge.id,
      { reason: 'Cobro duplicado.', authorization },
      ana,
      jefe,
    );

    expect(reversed.map((ticket) => ticket.status)).toEqual(['READY', 'READY']);
    expect(tickets.get('t1')?.payments).toEqual([]);
    expect(tickets.get('t1')?.commissionTotal).toBeNull();
    expect(tickets.get('t2')?.charge).toBeNull();
  });

  it('la nota lleva el motivo y quién autorizó (045 RN-5)', async () => {
    const { usecases, tickets, charge } = await charged();

    await usecases.voidById(charge.id, { reason: 'Cobro duplicado.', authorization }, ana, jefe);

    expect(tickets.get('t1')?.notes).toBe('Reverso: Cobro duplicado. (autorizó: Jefe)');
  });

  it('avisa una vez por lavado', async () => {
    const { usecases, events, charge } = await charged();

    await usecases.voidById(charge.id, { reason: 'Cobro duplicado.', authorization }, ana, jefe);

    expect(events.types).toEqual(['ticket.reversed', 'ticket.reversed']);
    expect(events.last?.previousStatus).toBe('PAID');
  });

  it('una cuenta que no existe es 404', async () => {
    const { usecases } = build([ticket('t1', '14.00')]);

    const failure = await captureApiError(
      usecases.voidById('charge-9', { reason: 'Cobro duplicado.', authorization }),
    );

    expect(failure.status).toBe(404);
  });

  it('no se deshace un lavado suelto de una cuenta mancomunada', async () => {
    const { usecases, tickets, charge } = await charged();
    const paid = tickets.get('t1');

    if (paid === undefined) throw new Error('missing ticket');

    const failure = await captureApiError(usecases.voidForTicket(paid, 'Cobro duplicado.'));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.TICKET_NOT_REVERSIBLE);
    expect(failure.body.message).toBe('Este cobro incluye 2 lavados: deshacelo completo.');
    expect(failure.body.details).toMatchObject({ chargeId: charge.id, ticketCount: 2 });
  });

  it('una cuenta de un solo lavado sí se deshace desde el lavado', async () => {
    const { usecases, tickets } = build([ticket('t1', '14.00')]);

    await usecases.create(
      { workOrderIds: ['t1'], payments: [{ method: 'CASH', amount: '14.00' }] },
      'u-ana',
    );

    const paid = tickets.get('t1');

    if (paid === undefined) throw new Error('missing ticket');

    const [reversed] = await usecases.voidForTicket(paid, 'Cobro duplicado.');

    expect(reversed.status).toBe('READY');
  });
});
