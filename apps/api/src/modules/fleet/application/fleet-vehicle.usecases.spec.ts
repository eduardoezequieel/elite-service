import { API_ERROR_CODES, createFleetVehicleSchema, fleetVehiclesQuerySchema } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { hideCosts } from './fleet-costs';
import { FleetVehicleUseCases } from './fleet-vehicle.usecases';
import type { FleetDayContext, FleetDaySource } from './ports/fleet-day.source';
import { EMPTY_FLEET_DAY } from './ports/fleet-day.source';
import { InMemoryFleetVehicleRepository } from './testing/in-memory-fleet-vehicle.repository';

const YARIS = createFleetVehicleSchema.parse({
  plate: 'P53DBC',
  make: 'Toyota',
  model: 'Yaris',
  year: 2022,
  dailyRate: '35.00',
});

/** La lista entera: la primera página, con el tope de filas. */
async function listOf(
  fleet: FleetVehicleUseCases,
  filter: Record<string, string> = {},
): Promise<FleetVehicle[]> {
  return (await fleet.list(fleetVehiclesQuerySchema.parse({ pageSize: 100, ...filter }))).items;
}

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
    expect(await listOf(fleet)).toHaveLength(1);
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

    expect((await listOf(fleet, { status: 'IN_SHOP' })).map((vehicle) => vehicle.id)).toEqual([
      first.id,
    ]);
    expect(await listOf(fleet, { status: 'ACTIVE' })).toHaveLength(1);
  });

  it('sin estado no lista retirados; ?status=RETIRED sí (110)', async () => {
    const created = await fleet.create(YARIS);

    await fleet.update(created.id, { status: 'RETIRED' });

    expect(await listOf(fleet)).toHaveLength(0);
    expect(await listOf(fleet, { status: 'RETIRED' })).toHaveLength(1);
    expect((await fleet.get(created.id)).availability).toBeNull();
  });

  it('el día y los avisos salen del API (110)', async () => {
    const now = new Date('2026-10-06T18:00:00.000Z');
    const oilId = '00000000-0000-4000-8000-0000000000ab';
    const days: FleetDaySource = {
      load: (ids) => {
        const byPlate = new Map(repo.rows.map((row) => [row.plate, row.id]));
        const id = (plate: string) => byPlate.get(plate) ?? '';
        const context: FleetDayContext = {
          ...EMPTY_FLEET_DAY,
          kmAlert: 500,
          daysAlert: 7,
          plan: [
            {
              id: oilId,
              key: 'oil',
              name: 'aceite',
              intervalKm: 5000,
              intervalDays: 90,
              sortOrder: 1,
              isActive: true,
            },
          ],
          lastServices: [
            {
              vehicleId: id('P99OIL'),
              taskId: oilId,
              performedAt: '2026-08-01',
              odometerKm: 45000,
            },
          ],
          agreements: [
            {
              id: '00000000-0000-4000-8000-0000000000a1',
              vehicleId: id('P11RES'),
              status: 'RESERVED' as const,
              plannedPickupAt: '2026-10-06T15:00:00.000Z',
              plannedReturnAt: '2026-10-08T15:00:00.000Z',
            },
            {
              id: '00000000-0000-4000-8000-0000000000a2',
              vehicleId: id('P22OUT'),
              status: 'IN_PROGRESS' as const,
              plannedPickupAt: '2026-10-04T15:00:00.000Z',
              plannedReturnAt: '2026-10-08T15:00:00.000Z',
            },
            {
              id: '00000000-0000-4000-8000-0000000000a3',
              vehicleId: id('P33LAT'),
              status: 'IN_PROGRESS' as const,
              plannedPickupAt: '2026-10-01T15:00:00.000Z',
              plannedReturnAt: '2026-10-05T15:00:00.000Z',
            },
            {
              id: '00000000-0000-4000-8000-0000000000a4',
              vehicleId: id('P44OLD'),
              status: 'RESERVED' as const,
              plannedPickupAt: '2026-10-05T15:00:00.000Z',
              plannedReturnAt: '2026-10-08T15:00:00.000Z',
            },
          ].filter((agreement) => ids.includes(agreement.vehicleId)),
        };

        return Promise.resolve(context);
      },
    };
    const dated = new FleetVehicleUseCases(repo, days, () => now);
    const make = (
      plate: string,
      extra: { odometerKm?: number; insuranceExpiresAt?: string | null } = {},
    ) => dated.create({ ...YARIS, plate, odometerKm: 1000, ...extra });

    const free = await make('P00FRE');
    const reserved = await make('P11RES');
    const rented = await make('P22OUT');
    const late = await make('P33LAT');
    const missed = await make('P44OLD');
    const shop = await make('P55SHP');
    await dated.update(shop.id, { status: 'IN_SHOP' });
    const warned = await make('P99OIL', {
      odometerKm: 51200,
      insuranceExpiresAt: '2026-10-09',
    });

    expect(free.availability).toBe('FREE');
    expect(reserved.availability).toBe('RESERVED');
    expect(rented.availability).toBe('RENTED');
    expect(late.availability).toBe('OVERDUE');
    expect(missed.availability).toBe('OVERDUE');
    expect((await dated.get(shop.id)).availability).toBe('WORKSHOP');
    expect(warned.alerts.map((alert) => alert.text)).toEqual([
      'Se pasó: iba a los 50.000 y va en 51.200: aceite',
      'Seguro vence en 3 días',
    ]);
  });

  it('busca por placa, marca o modelo', async () => {
    await fleet.create(YARIS);
    await fleet.create({ ...YARIS, plate: 'P22BBB', make: 'Kia', model: 'Rio' });

    expect(await listOf(fleet, { q: 'rio' })).toHaveLength(1);
    expect(await listOf(fleet, { q: 'p53' })).toHaveLength(1);
  });

  it('pagina en orden estable: disponibles primero y el total de todo el filtro (101)', async () => {
    const yaris = await fleet.create(YARIS);
    const rio = await fleet.create({ ...YARIS, plate: 'P22BBB', make: 'Kia', model: 'Rio' });
    const shop = await fleet.create({ ...YARIS, plate: 'P33CCC', make: 'Audi', model: 'A1' });
    await fleet.update(shop.id, { status: 'IN_SHOP' });

    const first = await fleet.list(fleetVehiclesQuerySchema.parse({ page: 1, pageSize: 2 }));
    const second = await fleet.list(fleetVehiclesQuerySchema.parse({ page: 2, pageSize: 2 }));

    expect(first).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(first.items.map((vehicle) => vehicle.id)).toEqual([rio.id, yaris.id]);
    expect(second.items.map((vehicle) => vehicle.id)).toEqual([shop.id]);
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
