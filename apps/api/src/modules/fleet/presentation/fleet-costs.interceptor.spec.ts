import { createFleetVehicleSchema } from '@elite/shared';

import { FleetVehicleUseCases } from '../application/fleet-vehicle.usecases';
import { InMemoryFleetVehicleRepository } from '../application/testing/in-memory-fleet-vehicle.repository';
import {
  canSeeCustomersOf,
  costAccessOf,
  maskCustomers,
  maskResponse,
} from './fleet-costs.interceptor';

const YARIS = createFleetVehicleSchema.parse({ make: 'Toyota', model: 'Yaris', dailyRate: '35' });
const NO_COSTS = { canSeeCosts: false };

describe('FleetCostsInterceptor (103)', () => {
  const fleet = new FleetVehicleUseCases(new InMemoryFleetVehicleRepository());

  it('ve costos solo quien tiene rentals.reports', () => {
    const user = { id: 'u', email: 'a@b.c', fullName: 'A', roles: [] };

    expect(costAccessOf({ ...user, permissions: ['fleet.read'] })).toEqual(NO_COSTS);
    expect(costAccessOf({ ...user, permissions: ['rentals.reports'] })).toEqual({
      canSeeCosts: true,
    });
  });

  it('la respuesta se enmascara en un carro, una lista y una página', async () => {
    const car = await fleet.create({ ...YARIS, purchasePrice: '9000.00' });
    const hidden = { purchasePrice: null, costsHidden: true };

    expect(maskResponse(car, NO_COSTS)).toMatchObject(hidden);
    expect(maskResponse([car], NO_COSTS)).toMatchObject([hidden]);
    expect(maskResponse({ items: [car], total: 1 }, NO_COSTS)).toMatchObject({
      items: [hidden],
      total: 1,
    });
    expect(maskResponse(car, { canSeeCosts: true })).toMatchObject({
      purchasePrice: '9000.00',
      costsHidden: false,
    });
  });

  it('el cliente de la actividad solo lo ve quien tiene rentals.read (115)', async () => {
    const user = { id: 'u', email: 'a@b.c', fullName: 'A', roles: [] };
    const car = await fleet.create(YARIS);
    const busy = {
      ...car,
      activity: { kind: 'RETURN' as const, at: '2026-10-08T15:00:00.000Z', customerName: 'Ana' },
    };

    expect(canSeeCustomersOf({ ...user, permissions: ['fleet.read'] })).toBe(false);
    expect(canSeeCustomersOf({ ...user, permissions: ['rentals.read'] })).toBe(true);
    expect(maskCustomers({ items: [busy, car] }, false)).toMatchObject({
      items: [{ activity: { kind: 'RETURN', customerName: null } }, { activity: null }],
    });
    expect(maskCustomers(busy, true)).toMatchObject({ activity: { customerName: 'Ana' } });
  });
});
