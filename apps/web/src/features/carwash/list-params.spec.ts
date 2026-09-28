import { ticketsListFrom, ticketsListQuery } from './list-params';

describe('la lista de lavados en la URL (056, 082)', () => {
  it('lee el día y la búsqueda', () => {
    expect(ticketsListFrom({ date: '2026-09-27', q: 'P123' })).toEqual({
      date: '2026-09-27',
      search: 'P123',
    });
  });

  it('un día roto, repetido o ausente es null; sin búsqueda queda vacía', () => {
    expect(ticketsListFrom({ date: '2026-13-40' })).toEqual({ date: null, search: '' });
    expect(ticketsListFrom({ date: ['2026-09-27', '2026-09-28'] }).date).toBeNull();
    expect(ticketsListFrom({ date: null, q: null })).toEqual({ date: null, search: '' });
  });

  it('escribe siempre el día y la búsqueda solo si hay', () => {
    expect(ticketsListQuery({ date: '2026-09-27', search: '' })).toBe('date=2026-09-27');
    expect(ticketsListQuery({ date: '2026-09-27', search: ' P123 ' })).toBe(
      'date=2026-09-27&q=P123',
    );
  });

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    const query = ticketsListQuery({ date: '2026-09-27', search: 'Juan Pérez' });
    const params = new URLSearchParams(query);

    expect(ticketsListFrom({ date: params.get('date'), q: params.get('q') })).toEqual({
      date: '2026-09-27',
      search: 'Juan Pérez',
    });
  });
});
