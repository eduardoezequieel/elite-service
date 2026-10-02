import { ticketsListFrom, ticketsListQuery } from './list-params';

describe('la lista de lavados en la URL (056, 082, 102)', () => {
  it('lee el día, la búsqueda y la página', () => {
    expect(ticketsListFrom({ date: '2026-09-27', q: 'P123', page: '3' })).toEqual({
      date: '2026-09-27',
      search: 'P123',
      page: 3,
    });
  });

  it('un día roto, repetido o ausente es null; sin búsqueda queda vacía; sin página, la 1', () => {
    expect(ticketsListFrom({ date: '2026-13-40' })).toEqual({ date: null, search: '', page: 1 });
    expect(ticketsListFrom({ date: ['2026-09-27', '2026-09-28'] }).date).toBeNull();
    expect(ticketsListFrom({ date: null, q: null, page: 'x' })).toEqual({
      date: null,
      search: '',
      page: 1,
    });
  });

  it('escribe siempre el día, la búsqueda solo si hay y la página desde la 2', () => {
    expect(ticketsListQuery({ date: '2026-09-27', search: '' })).toBe('date=2026-09-27');
    expect(ticketsListQuery({ date: '2026-09-27', search: ' P123 ', page: 1 })).toBe(
      'date=2026-09-27&q=P123',
    );
    expect(ticketsListQuery({ date: '2026-09-27', search: '', page: 2 })).toBe(
      'date=2026-09-27&page=2',
    );
  });

  it('ida y vuelta: lo que se escribe se lee igual', () => {
    const query = ticketsListQuery({ date: '2026-09-27', search: 'Juan Pérez', page: 4 });
    const params = new URLSearchParams(query);

    expect(
      ticketsListFrom({ date: params.get('date'), q: params.get('q'), page: params.get('page') }),
    ).toEqual({ date: '2026-09-27', search: 'Juan Pérez', page: 4 });
  });
});
