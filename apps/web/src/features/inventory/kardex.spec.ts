import type { InventoryMovement } from '@elite/shared';

import { MOVEMENT_TYPE_META, ticketLabel, toKardexRow } from './kardex';

function movement(overrides: Partial<InventoryMovement> = {}): InventoryMovement {
  return {
    id: 'm-1',
    itemId: 'i-1',
    itemCode: 'INV-0001',
    itemName: 'Cera en pasta',
    itemUnit: 'unidad',
    type: 'ENTRY',
    quantity: '10.000',
    balanceAfter: '10.000',
    unitCost: null,
    reference: null,
    reason: null,
    workOrderId: null,
    ticketNumber: null,
    counterSaleId: null,
    saleNumber: null,
    employee: null,
    createdBy: { kind: 'user', id: 'u-1', fullName: 'Administrador' },
    createdAt: '2026-09-26T15:00:00.000Z',
    ...overrides,
  };
}

describe('sello del tipo (065 UI)', () => {
  it('cada tipo tiene su palabra y su color', () => {
    expect(MOVEMENT_TYPE_META.ENTRY).toEqual({ label: 'Entrada', tone: 'green' });
    expect(MOVEMENT_TYPE_META.SALE.label).toBe('Venta');
    expect(MOVEMENT_TYPE_META.SALE.colorClass).toBe('text-info-text');
    expect(MOVEMENT_TYPE_META.SALE_RETURN.label).toBe('Devolución');
    expect(MOVEMENT_TYPE_META.DISPATCH).toEqual({ label: 'Despacho', tone: 'amber' });
    expect(MOVEMENT_TYPE_META.ADJUSTMENT.label).toBe('Ajuste');
  });

  it('ningún par de tipos comparte palabra', () => {
    const labels = Object.values(MOVEMENT_TYPE_META).map((meta) => meta.label);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('fila del kardex', () => {
  it('una entrada entra con signo y lleva costo y factura en el motivo', () => {
    const row = toKardexRow(
      movement({ unitCost: '3.50', reference: 'Factura 118', quantity: '10.000' }),
    );

    expect(row.quantity).toBe('+10');
    expect(row.isIncoming).toBe(true);
    expect(row.balance).toBe('10');
    expect(row.reason).toBe('$3.50 c/u · Factura 118');
    expect(row.origin).toBeNull();
    expect(row.toWhom).toBeNull();
  });

  it('una venta de lavado sale con signo y enlaza al lavado', () => {
    const row = toKardexRow(
      movement({
        type: 'SALE',
        quantity: '-2.000',
        balanceAfter: '1.000',
        workOrderId: 'w-9',
        ticketNumber: 'CW-0014',
      }),
    );

    expect(row.quantity).toBe('−2');
    expect(row.isIncoming).toBe(false);
    expect(row.origin).toEqual({
      kind: 'ticket',
      href: '/carwash/w-9',
      label: '#14',
      ariaLabel: 'Abrir el lavado #14',
    });
  });

  it('una devolución de venta suelta enlaza a la venta', () => {
    const row = toKardexRow(
      movement({
        type: 'SALE_RETURN',
        quantity: '2.000',
        counterSaleId: 's-3',
        saleNumber: 'V-0003',
      }),
    );

    expect(row.origin?.kind).toBe('sale');
    expect(row.origin?.href).toBe('/sales/s-3');
    expect(row.origin?.label).toBe('V-0003');
  });

  it('un despacho dice quién despachó y a quién, con la nota', () => {
    const row = toKardexRow(
      movement({
        type: 'DISPATCH',
        quantity: '-4.000',
        balanceAfter: '6.000',
        reason: 'Para la bahía 2',
        employee: { id: 'e-1', fullName: 'Carlos Méndez' },
      }),
    );

    expect(row.who).toBe('Administrador');
    expect(row.whoIsFloor).toBe(false);
    expect(row.toWhom).toBe('Carlos Méndez');
    expect(row.reason).toBe('Para la bahía 2');
  });

  it('la venta desde la tablet se marca como de pista', () => {
    const row = toKardexRow(
      movement({
        type: 'SALE',
        quantity: '-1.000',
        createdBy: { kind: 'employee', id: 'e-2', fullName: 'Ana López' },
      }),
    );

    expect(row.who).toBe('Ana López');
    expect(row.whoIsFloor).toBe(true);
  });

  it('un ajuste lleva su motivo y un movimiento sin autor queda sin nombre', () => {
    const row = toKardexRow(
      movement({
        type: 'ADJUSTMENT',
        quantity: '-1.000',
        reason: 'Conteo físico',
        createdBy: null,
      }),
    );

    expect(row.reason).toBe('Conteo físico');
    expect(row.who).toBeNull();
  });

  it('el folio del lavado se lee como #N', () => {
    expect(ticketLabel('CW-0142')).toBe('#142');
    expect(ticketLabel('raro')).toBe('raro');
  });
});
