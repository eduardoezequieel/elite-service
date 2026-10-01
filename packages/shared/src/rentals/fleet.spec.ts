import { createFleetVehicleSchema, fleetVehicleName, updateFleetVehicleSchema } from './fleet';

describe('createFleetVehicleSchema (095)', () => {
  it('normaliza la placa y nace con los valores por defecto', () => {
    const parsed = createFleetVehicleSchema.parse({
      plate: ' p53 dbc ',
      make: 'Toyota',
      model: 'Yaris',
      dailyRate: 35,
    });

    expect(parsed).toMatchObject({
      plate: 'P53DBC',
      dailyRate: '35.00',
      category: 'SEDAN',
      odometerKm: 0,
      financed: false,
    });
  });

  it('sin placa se acepta (RN-2)', () => {
    expect(
      createFleetVehicleSchema.parse({ plate: '', make: 'Kia', model: 'Rio', dailyRate: '30' })
        .plate,
    ).toBeNull();
    expect(
      createFleetVehicleSchema.parse({ make: 'Kia', model: 'Rio', dailyRate: '30' }).plate,
    ).toBeUndefined();
  });

  it('exige la tarifa diaria', () => {
    expect(createFleetVehicleSchema.safeParse({ make: 'Kia', model: 'Rio' }).success).toBe(false);
  });
});

describe('updateFleetVehicleSchema', () => {
  it('acepta solo el estado', () => {
    expect(updateFleetVehicleSchema.parse({ status: 'IN_SHOP' })).toEqual({ status: 'IN_SHOP' });
  });

  it('un null borra el dato', () => {
    expect(updateFleetVehicleSchema.parse({ weeklyRate: null })).toEqual({ weeklyRate: null });
  });
});

describe('fleetVehicleName', () => {
  it('marca, modelo y año', () => {
    expect(fleetVehicleName({ make: 'Toyota', model: 'Yaris', year: 2022 })).toBe(
      'Toyota Yaris 2022',
    );
    expect(fleetVehicleName({ make: 'Toyota', model: 'Yaris', year: null })).toBe('Toyota Yaris');
  });
});
