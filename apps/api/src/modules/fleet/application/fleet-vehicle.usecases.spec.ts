import { API_ERROR_CODES, createFleetVehicleSchema } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { hideCosts } from './fleet-costs';
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

  describe('costos (103, RN-1)', () => {
    const NO_COSTS = { canSeeCosts: false };

    it('sin rentals.reports: un PATCH con un campo de costo responde 403', async () => {
      const car = await fleet.create(YARIS);

      const error = await captureApiError(
        fleet.update(car.id, { insuranceMonthly: '40.00' }, NO_COSTS),
      );

      expect(error.status).toBe(403);
      expect(error.body).toMatchObject({
        code: API_ERROR_CODES.FORBIDDEN,
        details: { fields: ['insuranceMonthly'] },
      });
    });

    it('sin rentals.reports: un PATCH sin costos pasa (aseguradora y póliza no son costo)', async () => {
      const car = await fleet.create(YARIS);

      await expect(
        fleet.update(car.id, { insurer: 'Seguros del Pacífico', policyNumber: 'AU-1' }, NO_COSTS),
      ).resolves.toMatchObject({ insurer: 'Seguros del Pacífico', policyNumber: 'AU-1' });
    });

    it('sin rentals.reports: el alta con precio de compra responde 403; sin costos, pasa', async () => {
      const error = await captureApiError(
        fleet.create({ ...YARIS, purchasePrice: '9000.00' }, NO_COSTS),
      );

      expect(error.status).toBe(403);
      await expect(fleet.create(YARIS, NO_COSTS)).resolves.toMatchObject({ financed: false });
    });

    it('el enmascarado deja los costos en null y marca costsHidden', async () => {
      const car = await fleet.create({
        ...YARIS,
        purchasePrice: '9000.00',
        financed: true,
        installment: '350.00',
        installmentIncludesExtras: true,
        insuranceMonthly: '40.00',
      });

      expect(hideCosts(car)).toMatchObject({
        purchasePrice: null,
        financed: false,
        installment: null,
        installmentIncludesExtras: false,
        insuranceMonthly: null,
        costsHidden: true,
        dailyRate: '35.00',
      });
    });
  });

  describe('la cuota incluye seguro y GPS (103, RN-2)', () => {
    it('sin financiamiento se guarda en false', async () => {
      const car = await fleet.create({ ...YARIS, installmentIncludesExtras: true });

      expect(car.installmentIncludesExtras).toBe(false);
    });

    it('si financed pasa a false, la bandera también', async () => {
      const car = await fleet.create({ ...YARIS, financed: true, installmentIncludesExtras: true });
      expect(car.installmentIncludesExtras).toBe(true);

      await expect(fleet.update(car.id, { financed: false })).resolves.toMatchObject({
        financed: false,
        installmentIncludesExtras: false,
      });
    });
  });
});
