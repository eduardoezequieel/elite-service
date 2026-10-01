import { fleetVehicleSectionFor } from './frame-section';

describe('fleetVehicleSectionFor (095)', () => {
  it('cada pestaña sale de su ruta', () => {
    expect(fleetVehicleSectionFor('/rentals/fleet/v1')).toBe('details');
    expect(fleetVehicleSectionFor('/rentals/fleet/v1/maintenance')).toBe('maintenance');
    expect(fleetVehicleSectionFor('/rentals/fleet/v1/expenses')).toBe('expenses');
    expect(fleetVehicleSectionFor('/rentals/fleet/v1/months')).toBe('months');
  });
});
