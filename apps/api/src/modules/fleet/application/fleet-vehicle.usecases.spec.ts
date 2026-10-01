import { API_ERROR_CODES, createFleetVehicleSchema } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { FleetVehicleUseCases } from './fleet-vehicle.usecases';
import { InMemoryFleetVehicleRepository } from './testing/in-memory-fleet-vehicle.repository';

const YARIS = createFleetVehicleSchema.parse({
  plate: 'P53DBC',
  make: 'Toyota',
  model: 'Yaris',
  year: 2022,
  dailyRate: '35.00',
});

describe('FleetVehicleUseCases (095)', () => {
  let repo: InMemoryFleetVehicleRepository;
  let fleet: FleetVehicleUseCases;

  beforeEach(() => {
    repo = new InMemoryFleetVehicleRepository();
    fleet = new FleetVehicleUseCases(repo);
  });

  it('crea un carro ACTIVE que aparece en la lista', async () => {
    const created = await fleet.create(YARIS);

    expect(created).toMatchObject({ plate: 'P53DBC', status: 'ACTIVE', dailyRate: '35.00' });
    expect(await fleet.list({})).toHaveLength(1);
  });

  it('409 PLATE_TAKEN con la misma placa (RN-2)', async () => {
    await fleet.create(YARIS);

    const error = await captureApiError(fleet.create({ ...YARIS, model: 'Corolla' }));

    expect(error.status).toBe(409);
    expect(error.body.code).toBe(API_ERROR_CODES.PLATE_TAKEN);
  });

  it('dos carros sin placa conviven', async () => {
    await fleet.create({ ...YARIS, plate: null });
    await expect(fleet.create({ ...YARIS, plate: undefined })).resolves.toMatchObject({
      plate: null,
    });
  });

  it('editar con su propia placa no choca; con la de otro, sí', async () => {
    const first = await fleet.create(YARIS);
    const second = await fleet.create({ ...YARIS, plate: 'P11AAA' });

    await expect(fleet.update(first.id, { plate: 'P53DBC', color: 'Gris' })).resolves.toMatchObject(
      { color: 'Gris' },
    );

    const error = await captureApiError(fleet.update(second.id, { plate: 'P53DBC' }));
    expect(error.body.code).toBe(API_ERROR_CODES.PLATE_TAKEN);
  });

  it('cambia de estado y la lista filtra por estado', async () => {
    const first = await fleet.create(YARIS);
    await fleet.create({ ...YARIS, plate: 'P22BBB' });

    await fleet.update(first.id, { status: 'IN_SHOP' });

    expect((await fleet.list({ status: 'IN_SHOP' })).map((vehicle) => vehicle.id)).toEqual([
      first.id,
    ]);
    expect(await fleet.list({ status: 'ACTIVE' })).toHaveLength(1);
  });

  it('busca por placa, marca o modelo', async () => {
    await fleet.create(YARIS);
    await fleet.create({ ...YARIS, plate: 'P22BBB', make: 'Kia', model: 'Rio' });

    expect(await fleet.list({ q: 'rio' })).toHaveLength(1);
    expect(await fleet.list({ q: 'p53' })).toHaveLength(1);
  });

  it('404 si el carro no existe', async () => {
    const error = await captureApiError(fleet.get('00000000-0000-4000-8000-999999999999'));

    expect(error.status).toBe(404);
  });
});
