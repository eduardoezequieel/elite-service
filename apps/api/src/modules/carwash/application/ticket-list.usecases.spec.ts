import type { Ticket } from '@elite/shared';

import { InMemoryStock, InMemoryTicketRepository } from './testing/in-memory-ticket.repository';
import { readyTicket } from './testing/ready-ticket';
import { TicketUseCases } from './ticket.usecases';

const DAY = '2026-09-20';

function build(rows: Ticket[]) {
  const tickets = new InMemoryTicketRepository(new InMemoryStock());
  for (const row of rows) tickets.set(row);

  const usecases = new TicketUseCases(
    tickets,
    {} as never,
    tickets.customers,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { usecases };
}

/** Cinco lavados del día y uno de otro día, del más viejo al más nuevo. */
function dayRows(): Ticket[] {
  return [
    readyTicket('t1', '10.00', { status: 'OPEN', createdAt: '2026-09-20T14:00:00.000Z' }),
    readyTicket('t2', '12.00', { status: 'READY', createdAt: '2026-09-20T15:00:00.000Z' }),
    readyTicket('t3', '15.00', {
      status: 'PAID',
      createdAt: '2026-09-20T16:00:00.000Z',
      payments: [
        {
          method: 'CARD',
          amount: '15.00',
          paidAt: '2026-09-20T16:30:00.000Z',
          recordedBy: { id: 'u1', fullName: 'Ana' },
        } as Ticket['payments'][number],
      ],
    }),
    readyTicket('t4', '8.00', { status: 'VOID', createdAt: '2026-09-20T17:00:00.000Z' }),
    readyTicket('t5', '9.00', {
      status: 'WASHING',
      washers: [],
      customer: { id: 'c2', fullName: 'Beto', phone: null },
      createdAt: '2026-09-20T18:00:00.000Z',
    }),
    readyTicket('t6', '20.00', { status: 'PAID', createdAt: '2026-09-18T16:00:00.000Z' }),
  ];
}

describe('TicketUseCases.listPage (102)', () => {
  it('recorta la página, más nuevo primero, y cuenta todo el filtro', async () => {
    const { usecases } = build(dayRows());

    const page = await usecases.listPage({ date: DAY, page: 2, pageSize: 2 });

    expect(page.items.map((ticket) => ticket.id)).toEqual(['t3', 't2']);
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 5 });
  });

  it('el resumen es del día entero: no depende de la página, el estado ni los filtros', async () => {
    const { usecases } = build(dayRows());

    const first = await usecases.listPage({ date: DAY, page: 1, pageSize: 1 });
    const pending = await usecases.listPage({
      date: DAY,
      status: ['OPEN', 'WASHING', 'READY'],
      washerId: 'none',
      page: 1,
      pageSize: 25,
    });

    const expected = { queued: 2, ready: 1, paidCount: 1, paidTotal: '15.00', nonVoid: 4, all: 5 };
    expect(first.summary).toEqual(expected);
    expect(pending.summary).toEqual(expected);
    expect(pending.items.map((ticket) => ticket.id)).toEqual(['t5']);
    expect(pending.total).toBe(1);
  });

  it('las opciones salen del estado y la búsqueda, antes del popover', async () => {
    const { usecases } = build(dayRows());

    const page = await usecases.listPage({
      date: DAY,
      payment: 'CARD',
      page: 1,
      pageSize: 25,
    });

    expect(page.items.map((ticket) => ticket.id)).toEqual(['t3']);
    expect(page.facets.hasUnassigned).toBe(true);
    expect(page.facets.washers.map((washer) => washer.id)).toEqual(['emp-carlos']);
    expect(page.facets.services).toEqual([{ value: 's1', label: 'Lavado' }]);
  });

  it('«pending» trae los que no tienen pagos; la búsqueda se recorta', async () => {
    const { usecases } = build(dayRows());

    const pending = await usecases.listPage({
      date: DAY,
      payment: 'pending',
      page: 1,
      pageSize: 25,
    });
    const searched = await usecases.listPage({ date: DAY, q: '  beto ', page: 1, pageSize: 25 });

    expect(pending.total).toBe(4);
    expect(searched.items.map((ticket) => ticket.id)).toEqual(['t5']);
  });

  it('con cliente es su historial, de cualquier día, paginado', async () => {
    const { usecases } = build(dayRows());

    const page = await usecases.listPage({ customerId: 'c1', page: 1, pageSize: 3 });

    expect(page.items.map((ticket) => ticket.id)).toEqual(['t4', 't3', 't2']);
    expect(page.total).toBe(5);
    expect(page.summary.all).toBe(5);
  });
});
