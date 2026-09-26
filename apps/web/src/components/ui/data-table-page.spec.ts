import { pageLabel, pageWindow } from './data-table-page';

describe('pageWindow (067)', () => {
  it('corta de a 10', () => {
    expect(pageWindow(69, 10, 0)).toEqual({ page: 0, pages: 7, start: 0, end: 10 });
    expect(pageWindow(69, 10, 6)).toEqual({ page: 6, pages: 7, start: 60, end: 69 });
  });

  it('lleva una página fuera de rango a la última que existe', () => {
    expect(pageWindow(12, 10, 5)).toEqual({ page: 1, pages: 2, start: 10, end: 12 });
    expect(pageWindow(12, 10, -1)).toEqual({ page: 0, pages: 2, start: 0, end: 10 });
  });

  it('una lista vacía tiene una sola página, vacía', () => {
    expect(pageWindow(0, 10, 3)).toEqual({ page: 0, pages: 1, start: 0, end: 0 });
  });

  it('rotula la página como la lee el usuario', () => {
    expect(pageLabel(pageWindow(69, 10, 0), 69)).toBe('1–10 de 69');
    expect(pageLabel(pageWindow(69, 10, 6), 69)).toBe('61–69 de 69');
    expect(pageLabel(pageWindow(0, 10, 0), 0)).toBe('0–0 de 0');
  });
});
