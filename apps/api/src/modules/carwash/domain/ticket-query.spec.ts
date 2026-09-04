import { CUSTOMER_HISTORY_LIMIT, planTicketQuery } from './ticket-query';

describe('planTicketQuery (004)', () => {
  it('sin filtros es la fila de hoy, sin tope', () => {
    expect(planTicketQuery({})).toEqual({ byDay: true, date: undefined, limit: null });
  });

  it('con fecha es la fila de ese dia, sin tope', () => {
    expect(planTicketQuery({ date: '2026-08-30' })).toEqual({
      byDay: true,
      date: '2026-08-30',
      limit: null,
    });
  });

  it('con cliente no se recorta por dia y se limita a los ultimos', () => {
    expect(planTicketQuery({ customerId: 'c1' })).toEqual({
      byDay: false,
      limit: CUSTOMER_HISTORY_LIMIT,
    });
  });

  it('el cliente manda sobre la fecha: es su historial, no su dia', () => {
    expect(planTicketQuery({ customerId: 'c1', date: '2026-08-30' })).toEqual({
      byDay: false,
      limit: CUSTOMER_HISTORY_LIMIT,
    });
  });
});
