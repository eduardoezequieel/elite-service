import { INVENTORY_MOVEMENT_TYPES, type InventoryMovement } from '@elite/shared';

import { MOVEMENT_TYPE_META, detailOf, ticketLabel, toKardexRow } from './kardex';

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
    unitPrice: null,
    reversesMovementId: null,
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
    expect(MOVEMENT_TYPE_META.CONSUMPTION.label).toBe('Consumo');
    expect(MOVEMENT_TYPE_META.CONSUMPTION_RETURN.label).toBe('Consumo anulado');
  });

  it('todo tipo del contrato tiene sello, también los del consumo (070)', () => {
    for (const type of INVENTORY_MOVEMENT_TYPES) {
      expect(MOVEMENT_TYPE_META[type].label).not.toBe('');
    }
    expect(Object.keys(MOVEMENT_TYPE_META).sort()).toEqual([...INVENTORY_MOVEMENT_TYPES].sort());
  });

  it('el consumo no comparte color con el despacho ni con la venta (070)', () => {
    const consumption = MOVEMENT_TYPE_META.CONSUMPTION;

    expect(consumption.colorClass).toBe('text-consume-text');
    expect(consumption.tone).not.toBe(MOVEMENT_TYPE_META.DISPATCH.tone);
    expect(consumption.colorClass).not.toBe(MOVEMENT_TYPE_META.SALE.colorClass);
    expect(MOVEMENT_TYPE_META.CONSUMPTION_RETURN.colorClass).toBeUndefined();
    expect(MOVEMENT_TYPE_META.CONSUMPTION_RETURN.tone).toBe('neutral');
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

  it('un consumo dice a quién, con el precio congelado y la nota (070)', () => {
    const row = toKardexRow(
      movement({
        type: 'CONSUMPTION',
        quantity: '-2.000',
        balanceAfter: '8.000',
        unitPrice: '1.25',
        reason: 'Almuerzo',
        employee: { id: 'e-1', fullName: 'Juan Pérez' },
      }),
    );

    expect(row.quantity).toBe('−2');
    expect(row.isIncoming).toBe(false);
    expect(row.toWhom).toBe('Juan Pérez');
    expect(row.reason).toBe('$1.25 c/u · Almuerzo');
    expect(row.meta.label).toBe('Consumo');
  });

  it('la anulación de un consumo entra, dice a quién y lleva el motivo (070)', () => {
    const row = toKardexRow(
      movement({
        type: 'CONSUMPTION_RETURN',
        quantity: '2.000',
        unitPrice: '1.25',
        reason: 'Se anotó al equivocado',
        reversesMovementId: 'm-0',
        employee: { id: 'e-1', fullName: 'Juan Pérez' },
      }),
    );

    expect(row.quantity).toBe('+2');
    expect(row.isIncoming).toBe(true);
    expect(row.toWhom).toBe('Juan Pérez');
    expect(row.reason).toBe('Se anotó al equivocado');
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

describe('la columna «Detalle» (091)', () => {
  it('una entrada lleva la factura, lo que costó y quién la registró', () => {
    expect(detailOf(movement({ reference: 'Factura 88', unitCost: '1.10' }))).toEqual({
      lead: { kind: 'text', text: 'Factura 88' },
      notes: ['te costó $1.10 c/u', 'registró Administrador'],
    });
    expect(detailOf(movement()).lead).toEqual({
      kind: 'text',
      text: 'Sin referencia',
      muted: true,
    });
  });

  it('una venta enlaza al lavado y dice quién vendió, también desde la pista', () => {
    const detail = detailOf(
      movement({
        type: 'SALE',
        quantity: '-1.000',
        workOrderId: 'w-1',
        ticketNumber: 'CW-0141',
        createdBy: { kind: 'employee', id: 'e-1', fullName: 'Luis' },
      }),
    );

    expect(detail.lead).toMatchObject({ kind: 'origin', origin: { label: '#141' } });
    expect(detail.notes).toEqual(['vendió Luis · pista']);
  });

  it('un despacho dice quién recibió y quién entregó, con la nota', () => {
    expect(
      detailOf(
        movement({
          type: 'DISPATCH',
          quantity: '-4.000',
          reason: 'Bahía 2',
          employee: { id: 'e-1', fullName: 'Carlos' },
        }),
      ),
    ).toEqual({
      lead: { kind: 'person', prefix: 'Recibió', name: 'Carlos' },
      notes: ['entregó Administrador', 'Bahía 2'],
    });
  });

  it('un consumo dice quién tomó y cuánto vale a su precio congelado', () => {
    expect(
      detailOf(
        movement({
          type: 'CONSUMPTION',
          quantity: '-2.000',
          unitPrice: '1.25',
          employee: { id: 'e-1', fullName: 'Juan' },
        }),
      ),
    ).toEqual({
      lead: { kind: 'person', prefix: 'Tomó', name: 'Juan', suffix: '$2.50' },
      notes: ['anotó Administrador'],
    });
  });

  it('un ajuste lleva su motivo; sin autor, no dice quién', () => {
    expect(
      detailOf(movement({ type: 'ADJUSTMENT', reason: 'Conteo del viernes', createdBy: null })),
    ).toEqual({ lead: { kind: 'text', text: 'Conteo del viernes' }, notes: [] });
  });
});
