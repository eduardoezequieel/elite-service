import { planTicketQuery } from './ticket-query';

describe('planTicketQuery (004, 102)', () => {
  it('sin filtros es la fila de hoy', () => {
    expect(planTicketQuery({})).toEqual({ byDay: true, date: undefined });
  });

  it('con fecha es la fila de ese dia', () => {
    expect(planTicketQuery({ date: '2026-08-30' })).toEqual({ byDay: true, date: '2026-08-30' });
  });

  it('con cliente no se recorta por dia: lo acota la pagina', () => {
    expect(planTicketQuery({ customerId: 'c1' })).toEqual({ byDay: false });
  });

  it('el cliente manda sobre la fecha: es su historial, no su dia', () => {
    expect(planTicketQuery({ customerId: 'c1', date: '2026-08-30' })).toEqual({ byDay: false });
  });
});
