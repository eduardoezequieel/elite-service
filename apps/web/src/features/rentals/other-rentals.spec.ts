import type { AgreementStatus } from '@elite/shared';

import { otherRentals, type OtherRentalSource } from './other-rentals';

const rental = (id: string, status: AgreementStatus, balance = '0.00'): OtherRentalSource => ({
  id,
  status,
  totals: { balance },
});

const page = (items: OtherRentalSource[], total = items.length) => ({
  items,
  page: 1,
  pageSize: 100,
  total,
});

describe('Otras rentas del cliente (128)', () => {
  it('saca la renta abierta y muestra las 3 más recientes', () => {
    const result = otherRentals(
      page([
        rental('a', 'RESERVED'),
        rental('current', 'RESERVED'),
        rental('b', 'FINISHED'),
        rental('c', 'CANCELLED'),
        rental('d', 'FINISHED'),
      ]),
      'current',
    );

    expect(result.rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(result.count).toBe(4);
  });

  it('cuenta sobre el total del API, no sobre la página', () => {
    expect(otherRentals(page([rental('current', 'RESERVED')], 140), 'current').count).toBe(139);
  });

  it('un cliente sin otras rentas no tiene filas ni deuda', () => {
    expect(otherRentals(page([rental('current', 'RESERVED', '100.00')]), 'current')).toEqual({
      count: 0,
      owed: null,
      rows: [],
    });
  });

  it('debe solo lo de las devueltas, sin la abierta ni saldos a favor', () => {
    const result = otherRentals(
      page([
        rental('current', 'FINISHED', '20.00'),
        rental('a', 'FINISHED', '50.00'),
        rental('b', 'FINISHED', '12.50'),
        rental('c', 'IN_PROGRESS', '80.00'),
        rental('d', 'CANCELLED', '30.00'),
        rental('e', 'FINISHED', '-10.00'),
      ]),
      'current',
    );

    expect(result.owed).toBe('62.50');
  });
});
