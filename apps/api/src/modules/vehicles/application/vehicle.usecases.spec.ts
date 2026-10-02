import { API_ERROR_CODES } from '@elite/shared';
import type { Customer, VehicleBodyType } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import {
  CreateVehicleUseCase,
  ListBodyTypesUseCase,
  ListVehiclesUseCase,
  UpdateVehicleUseCase,
} from './vehicle.usecases';

const sedan: VehicleBodyType = { id: 'body-sedan', key: 'SEDAN', name: 'Sedán', sortOrder: 0 };
const pickup: VehicleBodyType = { id: 'body-pickup', key: 'PICKUP', name: 'Pick-up', sortOrder: 1 };

const ana: Customer = { id: 'customer-ana', fullName: 'Ana Mejía', phone: '7000-0000' };
const luis: Customer = { id: 'customer-luis', fullName: 'Luis Pérez', phone: null };

function build() {
  const vehicles = new InMemoryVehicleRepository([pickup, sedan], [ana, luis]);

  vehicles.seed(
    {
      id: 'vehicle-corolla',
      plate: 'P123-456',
      bodyTypeId: sedan.id,
      make: 'Toyota',
      color: 'Gris',
      isActive: true,
    },
    ana.id,
  );
  vehicles.seed({
    id: 'vehicle-hilux',
    plate: 'P777-001',
    bodyTypeId: pickup.id,
    make: null,
    color: null,
    isActive: true,
  });
  vehicles.seed(
    {
      id: 'vehicle-sold',
      plate: 'P999-999',
      bodyTypeId: sedan.id,
      make: null,
      color: null,
      isActive: false,
    },
    ana.id,
  );

  return vehicles;
}

describe('ListVehiclesUseCase', () => {
  it('sin filtro lista los vehículos activos', async () => {
    const listed = await new ListVehiclesUseCase(build()).execute();

    expect(listed.map((vehicle) => vehicle.id)).toEqual(['vehicle-corolla', 'vehicle-hilux']);
  });

  it('pagina con el total del filtro (102)', async () => {
    const list = new ListVehiclesUseCase(build());

    const second = await list.page({ page: 2, pageSize: 1 });
    expect(second).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(second.items.map((vehicle) => vehicle.id)).toEqual(['vehicle-hilux']);

    const filtered = await list.page({ q: 'p777', page: 1, pageSize: 25 });
    expect(filtered.total).toBe(1);
  });

  it('pasa la búsqueda por placa al repositorio', async () => {
    const listed = await new ListVehiclesUseCase(build()).execute({ query: 'p777' });

    expect(listed.map((vehicle) => vehicle.id)).toEqual(['vehicle-hilux']);
  });

  it('por cliente trae los carros que hoy son suyos (RN-12)', async () => {
    const listed = await new ListVehiclesUseCase(build()).execute({ customerId: ana.id });

    expect(listed.map((vehicle) => vehicle.id)).toEqual(['vehicle-corolla']);
    expect(listed[0]?.currentOwner).toEqual(ana);
  });
});

describe('ListBodyTypesUseCase', () => {
  it('devuelve los tipos de carro en su orden', async () => {
    expect(await new ListBodyTypesUseCase(build()).execute()).toEqual([sedan, pickup]);
  });
});

describe('CreateVehicleUseCase', () => {
  it('crea el vehículo con su dueño', async () => {
    const vehicles = build();

    const created = await new CreateVehicleUseCase(vehicles).execute({
      plate: 'P555-555',
      bodyTypeId: pickup.id,
      customerId: luis.id,
      make: 'Nissan',
    });

    expect(created).toMatchObject({
      plate: 'P555-555',
      bodyType: pickup,
      make: 'Nissan',
      color: null,
      isActive: true,
      currentOwner: luis,
    });
    expect(await vehicles.findByPlate('P555-555')).toEqual(created);
  });

  it('sin cliente el carro nace sin responsable (040)', async () => {
    const created = await new CreateVehicleUseCase(build()).execute({
      plate: 'P555-555',
      bodyTypeId: sedan.id,
    });

    expect(created.currentOwner).toBeNull();
  });

  it('409 PLATE_TAKEN si la placa ya existe', async () => {
    const failure = await captureApiError(
      new CreateVehicleUseCase(build()).execute({ plate: 'P123-456', bodyTypeId: sedan.id }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.PLATE_TAKEN);
  });

  /** La placa es única en la base, activa o no (079): no nace una segunda ficha. */
  it('409 PLATE_TAKEN también con la placa de un vehículo desactivado', async () => {
    const failure = await captureApiError(
      new CreateVehicleUseCase(build()).execute({ plate: 'P999-999', bodyTypeId: sedan.id }),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.PLATE_TAKEN);
  });

  it('422 VALIDATION_ERROR si el tipo de carro no existe, sin crear nada', async () => {
    const vehicles = build();

    const failure = await captureApiError(
      new CreateVehicleUseCase(vehicles).execute({ plate: 'P555-555', bodyTypeId: 'body-moto' }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    expect(failure.body.details).toEqual({ bodyTypeId: 'body-moto' });
    expect(await vehicles.findByPlate('P555-555')).toBeNull();
  });
});

describe('UpdateVehicleUseCase', () => {
  it('404 NOT_FOUND si el vehículo no existe', async () => {
    const failure = await captureApiError(
      new UpdateVehicleUseCase(build()).execute('vehicle-ghost', { color: 'Rojo' }),
    );

    expect(failure.status).toBe(404);
    expect(failure.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('deja guardar sin chocar contra su propia placa', async () => {
    const updated = await new UpdateVehicleUseCase(build()).execute('vehicle-corolla', {
      plate: 'P123-456',
      color: 'Blanco',
    });

    expect(updated).toMatchObject({ plate: 'P123-456', color: 'Blanco', make: 'Toyota' });
  });

  it('409 PLATE_TAKEN si toma la placa de otro vehículo', async () => {
    const failure = await captureApiError(
      new UpdateVehicleUseCase(build()).execute('vehicle-hilux', { plate: 'P123-456' }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.PLATE_TAKEN);
  });

  it('422 VALIDATION_ERROR si cambia a un tipo de carro que no existe', async () => {
    const vehicles = build();

    const failure = await captureApiError(
      new UpdateVehicleUseCase(vehicles).execute('vehicle-hilux', { bodyTypeId: 'body-moto' }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.details).toEqual({ bodyTypeId: 'body-moto' });
    expect((await vehicles.findById('vehicle-hilux'))?.bodyType).toEqual(pickup);
  });

  it('cambiar de dueño cierra la fila vigente y abre otra (RN-12)', async () => {
    const vehicles = build();

    const updated = await new UpdateVehicleUseCase(vehicles).execute('vehicle-corolla', {
      customerId: luis.id,
    });

    expect(updated.currentOwner).toEqual(luis);
    expect(
      vehicles.ownershipOf('vehicle-corolla').map((row) => [row.customerId, row.isCurrent]),
    ).toEqual([
      [ana.id, false],
      [luis.id, true],
    ]);
  });

  it('el mismo dueño no escribe historial (RN-12)', async () => {
    const vehicles = build();

    await new UpdateVehicleUseCase(vehicles).execute('vehicle-corolla', { customerId: ana.id });

    expect(vehicles.ownershipOf('vehicle-corolla')).toHaveLength(1);
  });

  it('sin `customerId` no toca al dueño', async () => {
    const vehicles = build();

    const updated = await new UpdateVehicleUseCase(vehicles).execute('vehicle-corolla', {
      isActive: false,
    });

    expect(updated.isActive).toBe(false);
    expect(updated.currentOwner).toEqual(ana);
    expect(vehicles.ownershipOf('vehicle-corolla')).toHaveLength(1);
  });
});

describe('UpdateVehicleUseCase: baja con lavado sin cobrar (090)', () => {
  it('409 VEHICLE_HAS_ACTIVE_TICKET y el carro sigue activo', async () => {
    const vehicles = build();

    vehicles.unchargedWashes.set('vehicle-corolla', {
      id: 'wo-2',
      number: 'CW-0002',
      status: 'READY',
    });

    const failure = await captureApiError(
      new UpdateVehicleUseCase(vehicles).execute('vehicle-corolla', { isActive: false }),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.VEHICLE_HAS_ACTIVE_TICKET);
    expect(failure.body.message).toBe(
      'Este carro tiene un lavado sin cobrar (#2). Cobralo o anulalo antes de desactivarlo.',
    );
    expect(failure.body.details).toEqual({
      ticketId: 'wo-2',
      number: 'CW-0002',
      plate: 'P123-456',
      status: 'READY',
    });
    expect((await vehicles.findById('vehicle-corolla'))?.isActive).toBe(true);
  });

  it('sin lavado pendiente lo desactiva', async () => {
    const updated = await new UpdateVehicleUseCase(build()).execute('vehicle-corolla', {
      isActive: false,
    });

    expect(updated.isActive).toBe(false);
  });

  it('con lavado pendiente deja editar lo demás', async () => {
    const vehicles = build();

    vehicles.unchargedWashes.set('vehicle-corolla', {
      id: 'wo-2',
      number: 'CW-0002',
      status: 'OPEN',
    });

    const updated = await new UpdateVehicleUseCase(vehicles).execute('vehicle-corolla', {
      color: 'Rojo',
    });

    expect(updated.color).toBe('Rojo');
  });
});
