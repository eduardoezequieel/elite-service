import type { Ticket } from '@elite/shared';

import {
  ALL_FILTER,
  countActiveFilters,
  matchesActivity,
  NONE_FILTER,
  PENDING_FILTER,
  placeFiltersPanel,
  ticketMatchesFilters,
  ticketWasherOptions,
  uniqueOptions,
  withAllOption,
} from './list-filters';

const BODY = { id: 'sedan', key: 'sedan', name: 'Sedán', sortOrder: 1 };

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1',
    number: 'CW-0001',
    status: 'OPEN',
    customer: { id: 'c1', fullName: 'Ana', phone: null, isActive: true },
    vehicle: {
      id: 'v1',
      plate: 'P123-456',
      make: null,
      color: null,
      bodyType: BODY,
      isActive: true,
      currentOwner: null,
    },
    bodyType: BODY,
    items: [
      {
        id: 'i1',
        serviceId: 's1',
        serviceCode: 'LC',
        serviceName: 'Lavado Completo',
        catalogPrice: '12.00',
        unitPrice: '12.00',
        sortOrder: 0,
      },
    ],
    total: '12.00',
    washer: { id: 'w1', username: 'pedro', fullName: 'Pedro Ramos' },
    washers: [{ id: 'w1', username: 'pedro', fullName: 'Pedro Ramos' }],
    commissionTotal: null,
    notes: null,
    payment: null,
    washingStartedAt: null,
    createdAt: '2026-09-06T12:00:00.000Z',
    updatedAt: '2026-09-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('list-filters (spec 035)', () => {
  it('cuenta solo los que no son Todos', () => {
    expect(countActiveFilters([ALL_FILTER, ALL_FILTER])).toBe(0);
    expect(countActiveFilters([ALL_FILTER, 's1', NONE_FILTER])).toBe(2);
  });

  it('actividad: Todos deja pasar, Activos e Inactivos recortan', () => {
    expect(matchesActivity(true, ALL_FILTER)).toBe(true);
    expect(matchesActivity(false, ALL_FILTER)).toBe(true);
    expect(matchesActivity(true, 'active')).toBe(true);
    expect(matchesActivity(false, 'active')).toBe(false);
    expect(matchesActivity(false, 'inactive')).toBe(true);
  });

  it('uniqueOptions deduplica y withAllOption pone Todos adelante', () => {
    const options = uniqueOptions(
      [
        { id: 'a', name: 'Sedán' },
        { id: 'a', name: 'Sedán' },
        { id: 'b', name: 'Moto' },
      ],
      (row) => row.id,
      (row) => row.name,
    );
    expect(options).toEqual([
      { value: 'a', label: 'Sedán' },
      { value: 'b', label: 'Moto' },
    ]);
    expect(withAllOption('Todas las carrocerías', options)[0]).toEqual({
      value: ALL_FILTER,
      label: 'Todas las carrocerías',
    });
  });

  it('un lavado pasa si todos los recortes calzan', () => {
    const row = ticket();
    expect(ticketMatchesFilters(row, {})).toBe(true);
    expect(ticketMatchesFilters(row, { bodyTypeId: 'sedan', serviceId: 's1', washerId: 'w1' })).toBe(
      true,
    );
    expect(ticketMatchesFilters(row, { bodyTypeId: 'moto' })).toBe(false);
    expect(ticketMatchesFilters(row, { serviceId: 'other' })).toBe(false);
    expect(ticketMatchesFilters(row, { washerId: 'w2' })).toBe(false);
    expect(ticketMatchesFilters(row, { payment: PENDING_FILTER })).toBe(true);
    expect(ticketMatchesFilters(row, { payment: 'CASH' })).toBe(false);
    expect(ticketMatchesFilters(row, { status: 'OPEN' })).toBe(true);
    expect(ticketMatchesFilters(row, { status: 'PAID' })).toBe(false);
  });

  it('Sin asignar solo deja lavados sin empleado', () => {
    const assigned = ticket();
    const bare = ticket({ washers: [], washer: null });
    expect(ticketMatchesFilters(assigned, { washerId: NONE_FILTER })).toBe(false);
    expect(ticketMatchesFilters(bare, { washerId: NONE_FILTER })).toBe(true);
    expect(ticketWasherOptions([assigned, bare]).map((option) => option.value)).toEqual([
      NONE_FILTER,
      'w1',
    ]);
  });

  it('la tarjeta se alinea a la derecha del botón y se da vuelta si no cabe', () => {
    const trigger = { top: 40, bottom: 80, left: 500, width: 120 };
    const below = placeFiltersPanel(trigger, { width: 330, height: 280 }, { width: 800, height: 900 });
    expect(below.left).toBe(500 + 120 - 330);
    expect(below.top).toBe(88);
    expect(below.width).toBe(330);

    const tight = placeFiltersPanel(
      { top: 700, bottom: 740, left: 500, width: 120 },
      { width: 330, height: 280 },
      { width: 800, height: 780 },
    );
    expect(tight.top).toBe(700 - 8 - 280);
  });
});
