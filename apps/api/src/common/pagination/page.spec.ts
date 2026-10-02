import { pageSkip, slicePage } from './page';

describe('slicePage (101)', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'];

  it('recorta la página pedida y cuenta todas las filas', () => {
    expect(slicePage(rows, { page: 2, pageSize: 2 })).toEqual({
      items: ['c', 'd'],
      page: 2,
      pageSize: 2,
      total: 5,
    });
  });

  it('una página fuera de rango sale vacía con el total de siempre', () => {
    expect(slicePage(rows, { page: 9, pageSize: 2 })).toMatchObject({ items: [], total: 5 });
  });

  it('el skip de Prisma de la página 3 de a 25', () => {
    expect(pageSkip({ page: 3, pageSize: 25 })).toBe(50);
  });
});
