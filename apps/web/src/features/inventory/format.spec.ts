import type { Page } from '@elite/shared';

import { timeLabel } from '@/lib/civil-date';

import {
  availableLabel,
  formatMovementDate,
  itemReference,
  pageCount,
  pagedReference,
  pageSummary,
} from './format';

function page<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, page: 1, pageSize: 50, total: items.length, ...overrides };
}

describe('cantidades (065 RN-16)', () => {
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
    expect(timeLabel(iso)).toMatch(/8:30/);
    expect(timeLabel(iso)).toMatch(/p\.m\./);
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
