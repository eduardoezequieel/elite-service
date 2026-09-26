import type { CarwashEvent, InventoryLowStockEvent, Ticket } from '@elite/shared';

import { isWorthNotifying, toNotification, toStockNotification } from './notification';

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't-1',
    number: 'CW-0142',
    status: 'READY',
    customer: null,
    vehicle: {
      id: 'v1',
      plate: 'P123-456',
      bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
      make: null,
      color: null,
      isActive: true,
      currentOwner: null,
      lastWash: null,
    },
    bodyType: { id: 'b1', key: 'sedan', name: 'Sedán', sortOrder: 1 },
    items: [],
    total: '14.00',
    washer: null,
    washers: [],
    commissionTotal: null,
    notes: null,
    payments: [],
    charge: null,
    washingStartedAt: null,
    readyAt: null,
    createdAt: '2026-09-13T15:00:00.000Z',
    updatedAt: '2026-09-13T15:00:00.000Z',
    ...overrides,
  };
}

function event(overrides: Partial<CarwashEvent> = {}): CarwashEvent {
  return {
    id: 'ev-1',
    type: 'ticket.status.changed',
    at: '2026-09-13T15:00:00.000Z',
    ticket: ticket(),
    previousStatus: 'WASHING',
    actor: { kind: 'employee', id: 'emp-carlos', name: 'Carlos' },
    ...overrides,
  };
}

describe('toNotification', () => {
  it('nombra el lavado como se lo grita en la bahía, no con el folio', () => {
    expect(toNotification(event()).title).toBe('#142 pasó a listo');
  });

  it('la placa va en el detalle, sola', () => {
    expect(toNotification(event()).description).toBe('P123-456');
  });

  it('quién lo movió va en su propio renglón, y dice desde dónde', () => {
    // Oficina y pista pueden mover el mismo lavado: sin el «desde dónde» hay
    // que adivinar si fue quien lava o quien está en el mostrador.
    expect(toNotification(event()).by).toBe('Carlos · pista');
    expect(toNotification(event({ actor: { kind: 'user', id: 'u-ana', name: 'Ana' } })).by).toBe(
      'Ana · oficina',
    );
  });

  it('pinta de verde lo que avanza y de rojo lo que se cae', () => {
    expect(toNotification(event()).tone).toBe('go');
    expect(toNotification(event({ type: 'ticket.voided' })).tone).toBe('danger');
    expect(toNotification(event({ type: 'ticket.reversed' })).tone).toBe('danger');
    expect(toNotification(event({ type: 'ticket.created' })).tone).toBe('neutral');
  });

  it('cada aviso trae su tipo, que es por donde se filtra el cajón (058)', () => {
    expect(toNotification(event({ type: 'ticket.created' })).kind).toBe('in');
    expect(toNotification(event({ type: 'ticket.charged' })).kind).toBe('cash');
    expect(toNotification(event({ type: 'ticket.reversed' })).kind).toBe('cash');
    expect(toNotification(event({ type: 'ticket.voided' })).kind).toBe('void');
    expect(toNotification(event({ type: 'ticket.status.changed' })).kind).toBe('move');
    expect(toNotification(event({ type: 'ticket.assigned' })).kind).toBe('move');
  });

  it('el cobro lleva el monto', () => {
    const notification = toNotification(event({ type: 'ticket.charged' }));

    expect(notification.title).toBe('Se cobró #142');
    expect(notification.description).toBe('P123-456 · $14.00');
    expect(notification.by).toBe('Carlos · pista');
  });

  it('la reasignación dice a quién quedó, o que quedó sin asignar', () => {
    const assigned = toNotification(
      event({
        type: 'ticket.assigned',
        ticket: ticket({ washers: [{ id: 'e1', username: 'jose', fullName: 'José VIS' }] }),
      }),
    );

    // Acá hay dos personas: quien reasignó (`by`) y a quién le quedó.
    expect(assigned.description).toBe('P123-456 · ahora a cargo de José VIS');
    expect(assigned.by).toBe('Carlos · pista');
    expect(toNotification(event({ type: 'ticket.assigned' })).description).toBe(
      'P123-456 · quedó sin asignar',
    );
  });

  it('lleva al lavado', () => {
    expect(toNotification(event()).href).toBe('/carwash/t-1');
  });

  it('nace sin leer y conserva el id del evento, que es lo que deduplica', () => {
    const notification = toNotification(event({ id: 'ev-9' }));

    expect(notification.read).toBe(false);
    expect(notification.id).toBe('ev-9');
  });

  it('sin actor no inventa un nombre: el renglón no existe', () => {
    expect(toNotification(event({ actor: null })).by).toBeNull();
    expect(toNotification(event({ actor: null })).description).toBe('P123-456');
  });
});

describe('isWorthNotifying', () => {
  it('no te avisa de lo que acabás de hacer', () => {
    const mine = event({ actor: { kind: 'user', id: 'u-ana', name: 'Ana' } });

    expect(isWorthNotifying(mine, 'u-ana')).toBe(false);
  });

  it('sí avisa de lo que hizo otro', () => {
    expect(isWorthNotifying(event(), 'u-ana')).toBe(true);
  });

  it('sin actor avisa igual: es mejor de más que perderse el cambio', () => {
    expect(isWorthNotifying(event({ actor: null }), 'u-ana')).toBe(true);
  });
});

function lowStock(overrides: Partial<InventoryLowStockEvent> = {}): InventoryLowStockEvent {
  return {
    id: 'ev-stock-1',
    type: 'inventory.low_stock',
    at: '2026-09-26T15:00:00.000Z',
    itemId: 'inv-wax',
    name: 'Cera en pasta',
    stockOnHand: '4.000',
    minStock: '5.000',
    unit: 'unidad',
    actor: { kind: 'employee', id: 'emp-carlos', name: 'Carlos' },
    ...overrides,
  };
}

describe('toStockNotification (065)', () => {
  it('dice qué se acaba y cuánto queda, con la unidad', () => {
    const notification = toStockNotification(lowStock());

    expect(notification.title).toBe('Cera en pasta se está acabando');
    expect(notification.description).toBe('quedan 4 unidades (mínimo 5)');
  });

  it('una sola unidad va en singular y los decimales sin relleno', () => {
    expect(toStockNotification(lowStock({ stockOnHand: '1.000' })).description).toBe(
      'quedan 1 unidad (mínimo 5)',
    );
    expect(
      toStockNotification(lowStock({ stockOnHand: '0.500', minStock: '2.000', unit: 'galón' }))
        .description,
    ).toBe('quedan 0.5 galones (mínimo 2)');
  });

  it('es del tipo «Inventario», en rojo, y lleva al artículo', () => {
    const notification = toStockNotification(lowStock());

    expect(notification.kind).toBe('stock');
    expect(notification.tone).toBe('danger');
    expect(notification.href).toBe('/inventory/inv-wax');
  });

  it('conserva el id del evento, nace sin leer y dice quién movió', () => {
    const notification = toStockNotification(lowStock());

    expect(notification.id).toBe('ev-stock-1');
    expect(notification.read).toBe(false);
    expect(notification.by).toBe('Carlos · pista');
    expect(toStockNotification(lowStock({ actor: null })).by).toBeNull();
  });
});
