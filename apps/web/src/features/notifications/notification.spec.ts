import type { CarwashEvent, Ticket } from '@elite/shared';

import { isWorthNotifying, toNotification } from './notification';

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
    payment: null,
    washingStartedAt: null,
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

  it('pone la placa en el detalle, con quién lo hizo', () => {
    expect(toNotification(event()).description).toBe('P123-456 · Carlos');
  });

  it('pinta de verde lo que avanza y de rojo lo que se cae', () => {
    expect(toNotification(event()).tone).toBe('go');
    expect(toNotification(event({ type: 'ticket.voided' })).tone).toBe('danger');
    expect(toNotification(event({ type: 'ticket.reversed' })).tone).toBe('danger');
    expect(toNotification(event({ type: 'ticket.created' })).tone).toBe('neutral');
  });

  it('el cobro lleva el monto', () => {
    const notification = toNotification(event({ type: 'ticket.charged' }));

    expect(notification.title).toBe('Se cobró #142');
    expect(notification.description).toBe('P123-456 · $14.00 · Carlos');
  });

  it('la reasignación dice a quién quedó, o que quedó sin asignar', () => {
    const assigned = toNotification(
      event({
        type: 'ticket.assigned',
        ticket: ticket({ washers: [{ id: 'e1', username: 'jose', fullName: 'José VIS' }] }),
      }),
    );

    expect(assigned.description).toBe('P123-456 · José VIS');
    expect(toNotification(event({ type: 'ticket.assigned' })).description).toBe(
      'P123-456 · sin asignar',
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

  it('sin actor no inventa un nombre', () => {
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
