import type { CarwashEvent, InventoryLowStockEvent } from '@elite/shared';

import { eventTypeFor, isVisibleToEmployee, isVisibleToUser } from './carwash-event';
import type { VisibilityCheck } from './carwash-event';

describe('eventTypeFor', () => {
  it('agrupa las tres transiciones operativas en un solo evento de estado', () => {
    expect(eventTypeFor('start')).toBe('ticket.status.changed');
    expect(eventTypeFor('ready')).toBe('ticket.status.changed');
    expect(eventTypeFor('reopen')).toBe('ticket.status.changed');
  });

  it('le da nombre propio a cobrar, anular y deshacer', () => {
    expect(eventTypeFor('charge')).toBe('ticket.charged');
    expect(eventTypeFor('void')).toBe('ticket.voided');
    expect(eventTypeFor('reverse')).toBe('ticket.reversed');
  });
});

describe('isVisibleToEmployee (036)', () => {
  const carlos = 'emp-carlos';
  const ticket = (overrides: Partial<VisibilityCheck> = {}): VisibilityCheck => ({
    status: 'WASHING',
    washers: [{ id: carlos }],
    ...overrides,
  });

  it('deja pasar el lavado operativo del propio empleado', () => {
    expect(isVisibleToEmployee(ticket(), carlos)).toBe(true);
    expect(isVisibleToEmployee(ticket({ status: 'OPEN' }), carlos)).toBe(true);
    expect(isVisibleToEmployee(ticket({ status: 'READY' }), carlos)).toBe(true);
  });

  it('no filtra el lavado de otro', () => {
    expect(isVisibleToEmployee(ticket(), 'emp-ana')).toBe(false);
  });

  it('no filtra el lavado sin asignar', () => {
    expect(isVisibleToEmployee(ticket({ washers: [] }), carlos)).toBe(false);
  });

  it('no empuja cobrados ni anulados: la fila de pista no los muestra', () => {
    expect(isVisibleToEmployee(ticket({ status: 'PAID' }), carlos)).toBe(false);
    expect(isVisibleToEmployee(ticket({ status: 'VOID' }), carlos)).toBe(false);
  });
});

describe('isVisibleToUser (065 RN-13)', () => {
  const lowStock: InventoryLowStockEvent = {
    id: 'ev-1',
    type: 'inventory.low_stock',
    at: '2026-09-26T12:00:00.000Z',
    itemId: 'wax',
    name: 'Cera en pasta',
    stockOnHand: '4.000',
    minStock: '5.000',
    unit: 'unidad',
    actor: null,
  };
  const ticketEvent = { type: 'ticket.updated' } as CarwashEvent;

  it('el aviso de minimo solo llega a quien tiene inventory.read', () => {
    expect(isVisibleToUser(lowStock, ['carwash.read', 'inventory.read'])).toBe(true);
    expect(isVisibleToUser(lowStock, ['carwash.read'])).toBe(false);
  });

  it('los del lavado llegan a todos los que abrieron el stream', () => {
    expect(isVisibleToUser(ticketEvent, ['carwash.read'])).toBe(true);
  });
});
