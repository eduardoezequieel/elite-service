import { pageOf, skipTake, slicePage } from './page';

describe('pagination helpers', () => {
  it('traduce la página a skip/take', () => {
    expect(skipTake({ page: 1, pageSize: 25 })).toEqual({ skip: 0, take: 25 });
    expect(skipTake({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it('arma la página con el total del filtro', () => {
    expect(pageOf(['a'], 7, { page: 2, pageSize: 1 })).toEqual({
      items: ['a'],
      page: 2,
      pageSize: 1,
      total: 7,
    });
  });

  it('recorta en memoria y cuenta todas las filas', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'];

    expect(slicePage(rows, { page: 2, pageSize: 2 })).toEqual({
      items: ['c', 'd'],
      page: 2,
      pageSize: 2,
      total: 5,
    });
    expect(slicePage(rows, { page: 4, pageSize: 2 }).items).toEqual([]);
  });
});
