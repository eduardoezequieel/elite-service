import { createFleetVehicleSchema } from '@elite/shared';

import { FleetVehicleUseCases } from '../application/fleet-vehicle.usecases';
import { InMemoryFleetVehicleRepository } from '../application/testing/in-memory-fleet-vehicle.repository';
import { costAccessOf, maskResponse } from './fleet-costs.interceptor';

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
});
