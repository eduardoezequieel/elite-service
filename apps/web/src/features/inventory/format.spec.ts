import type { Page } from '@elite/shared';

import {
  availableLabel,
  formatMovementDate,
  formatMovementTime,
  formatQuantity,
  formatQuantityWithUnit,
  formatSignedQuantity,
  itemReference,
  milliToQuantity,
  pageCount,
  pagedReference,
  pageSummary,
  quantityMilli,
} from './format';

function page<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, page: 1, pageSize: 50, total: items.length, ...overrides };
}

describe('cantidades (065 RN-16)', () => {
  it('cuenta en milésimas enteras, con y sin signo', () => {
    expect(quantityMilli('2.500')).toBe(2500);
    expect(quantityMilli('-2.000')).toBe(-2000);
    expect(quantityMilli('+10')).toBe(10000);
    expect(quantityMilli('0.001')).toBe(1);
    expect(quantityMilli('dos')).toBeNull();
    expect(quantityMilli('1.2345')).toBeNull();
  });

  it('vuelve a cadena de tres decimales', () => {
    expect(milliToQuantity(2500)).toBe('2.500');
    expect(milliToQuantity(-1000)).toBe('-1.000');
    expect(milliToQuantity(7)).toBe('0.007');
  });

  it('se lee sin los ceros que sobran', () => {
    expect(formatQuantity('10.000')).toBe('10');
    expect(formatQuantity('2.500')).toBe('2.5');
    expect(formatQuantity('0.125')).toBe('0.125');
    expect(formatQuantity('-2.000')).toBe('−2');
  });

  it('lleva el signo siempre a la vista en el kardex', () => {
    expect(formatSignedQuantity('10.000')).toBe('+10');
    expect(formatSignedQuantity('-4.000')).toBe('−4');
  });

  it('pega la unidad tal cual la escribió el taller', () => {
    expect(formatQuantityWithUnit('4.000', 'litro')).toBe('4 litro');
    expect(formatQuantityWithUnit('4.000', '  ')).toBe('4');
  });

  it('dice «Hay N» con la existencia (RN-3, RN-17)', () => {
    expect(availableLabel('1.000')).toBe('Hay 1');
    expect(availableLabel('2.500', 'galón')).toBe('Hay 2.5 galón');
  });
});

describe('fecha y hora del kardex', () => {
  it('usa la hora del taller, no la UTC', () => {
    // 02:30 UTC del 27 es 20:30 del 26 en El Salvador.
    const iso = '2026-09-27T02:30:00.000Z';

    expect(formatMovementDate(iso)).toMatch(/26/);
    expect(formatMovementDate(iso)).toMatch(/2026/);
    expect(formatMovementTime(iso)).toMatch(/8:30/);
    expect(formatMovementTime(iso)).toMatch(/p\.m\./);
  });
});

describe('referencias y páginas', () => {
  it('el número del artículo sale de su código', () => {
    expect(itemReference('INV-0012')).toBe(12);
    expect(itemReference('raro')).toBe(0);
  });

  it('resume la página', () => {
    const noun = { one: 'movimiento', many: 'movimientos' };

    expect(pageSummary(page([]), noun)).toBe('0 movimientos');
    expect(pageSummary(page(['a']), noun)).toBe('1 movimiento');
    expect(pageSummary(page(['a', 'b'], { page: 2, pageSize: 2, total: 5 }), noun)).toBe(
      '3–4 de 5 movimientos',
    );
  });

  it('cuenta páginas y numera filas a lo largo de todas', () => {
    expect(pageCount(page([], { total: 0 }))).toBe(1);
    expect(pageCount(page([], { total: 101, pageSize: 50 }))).toBe(3);
    expect(pagedReference(page(['a'], { page: 3, pageSize: 50, total: 120 }), 0)).toBe(101);
    expect(pagedReference(undefined, 4)).toBe(5);
  });
});
