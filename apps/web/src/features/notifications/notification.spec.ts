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
