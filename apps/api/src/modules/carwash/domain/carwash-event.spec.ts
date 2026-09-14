import { eventTypeFor, isVisibleToEmployee } from './carwash-event';
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
