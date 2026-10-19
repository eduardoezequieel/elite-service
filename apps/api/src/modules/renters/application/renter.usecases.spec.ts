import { API_ERROR_CODES, createRenterSchema, rentersQuerySchema } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { RenterUseCases } from './renter.usecases';
import { InMemoryRenterRepository } from './testing/in-memory-renter.repository';

const query = (filter: Record<string, string | number> = {}) => rentersQuerySchema.parse(filter);

describe('RenterUseCases (095)', () => {
  let repo: InMemoryRenterRepository;
  let renters: RenterUseCases;

  beforeEach(() => {
    repo = new InMemoryRenterRepository();
    renters = new RenterUseCases(repo);
  });

  it('un cliente bloqueado sale con ?blocked=true', async () => {
    await renters.create(createRenterSchema.parse({ fullName: 'Ana López' }));
    const blocked = await renters.create(
      createRenterSchema.parse({ fullName: 'Beto Ruiz', isBlocked: true, blockReason: 'Chocó' }),
    );

    expect(
      (await renters.list(query({ blocked: 'true' }))).items.map((renter) => renter.id),
    ).toEqual([blocked.id]);
    expect(blocked.blockReason).toBe('Chocó');
  });

  it('pagina por nombre con el total del filtro entero (101)', async () => {
    for (const fullName of ['Carla Díaz', 'Ana López', 'Beto Ruiz']) {
      await renters.create(createRenterSchema.parse({ fullName }));
    }

    const second = await renters.list(query({ page: 2, pageSize: 2 }));

    expect(second).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(second.items.map((renter) => renter.fullName)).toEqual(['Carla Díaz']);
  });

  it('desbloquear borra el motivo', async () => {
    const blocked = await renters.create(
      createRenterSchema.parse({ fullName: 'Beto Ruiz', isBlocked: true, blockReason: 'Chocó' }),
    );

    const updated = await renters.update(blocked.id, { isBlocked: false });

    expect(updated).toMatchObject({ isBlocked: false, blockReason: null });
  });

  it('se desactiva y ?active=false lo trae', async () => {
    const renter = await renters.create(createRenterSchema.parse({ fullName: 'Ana López' }));

    await renters.update(renter.id, { isActive: false });

    expect((await renters.list(query({ active: 'false' }))).items).toHaveLength(1);
    expect((await renters.list(query({ active: 'true' }))).items).toHaveLength(0);
  });

  it('importa las filas válidas y reporta las omitidas con su fila (RN-9)', async () => {
    const result = await renters.import({
      rows: [
        { Nombre: 'Ana López', DUI: '01234567-8' },
        { Nombre: '', DUI: '9' },
        { Nombre: 'Carla Paz', Nacimiento: '31/02/1990' },
        { nombre: 'Diego Sol', celular: '7777-8888' },
      ],
    });

    expect(result.created).toBe(2);
    expect(result.skipped).toEqual([
      { row: 3, reason: 'Sin nombre.' },
      { row: 4, reason: 'La fecha «31/02/1990» no se entiende.' },
    ]);
    expect(repo.rows.map((row) => row.fullName)).toEqual(['Ana López', 'Diego Sol']);
  });

  it('404 al editar uno que no existe', async () => {
    const error = await captureApiError(
      renters.update('00000000-0000-4000-8000-999999999999', { fullName: 'X' }),
    );

    expect(error.status).toBe(404);
    expect(error.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('cada cliente trae sus rentas no canceladas y la última salida ya ocurrida (118)', async () => {
    const ana = await renters.create(createRenterSchema.parse({ fullName: 'Ana López' }));
    await renters.create(createRenterSchema.parse({ fullName: 'Beto Ruiz' }));
    repo.rentals.push(
      { customerId: ana.id, status: 'FINISHED', actualPickupAt: '2026-10-01T15:00:00.000Z' },
      { customerId: ana.id, status: 'IN_PROGRESS', actualPickupAt: '2026-10-10T15:00:00.000Z' },
      { customerId: ana.id, status: 'RESERVED', actualPickupAt: null },
      { customerId: ana.id, status: 'CANCELLED', actualPickupAt: '2026-10-15T15:00:00.000Z' },
    );

    const page = await renters.list(query());

    expect(
      page.items.map((renter) => [renter.fullName, renter.rentalsCount, renter.lastRentalAt]),
    ).toEqual([
      ['Ana López', 3, '2026-10-10T15:00:00.000Z'],
      ['Beto Ruiz', 0, null],
    ]);
  });

  it('sort=recent pone primero la renta más reciente y al final los que nunca rentaron (118)', async () => {
    const ana = await renters.create(createRenterSchema.parse({ fullName: 'Ana López' }));
    const beto = await renters.create(createRenterSchema.parse({ fullName: 'Beto Ruiz' }));
    await renters.create(createRenterSchema.parse({ fullName: 'Aarón Paz' }));
    repo.rentals.push(
      { customerId: ana.id, status: 'FINISHED', actualPickupAt: '2026-09-01T15:00:00.000Z' },
      { customerId: beto.id, status: 'FINISHED', actualPickupAt: '2026-10-01T15:00:00.000Z' },
    );

    const names = (await renters.list(query({ sort: 'recent' }))).items.map((r) => r.fullName);

    expect(names).toEqual(['Beto Ruiz', 'Ana López', 'Aarón Paz']);
  });

  it('busca por todas las palabras del nombre o por 3+ dígitos sin guiones (118)', async () => {
    await renters.create(
      createRenterSchema.parse({
        fullName: 'Juan Carlos Pérez',
        documentId: '01234567-8',
        mobilePhone: '7123-4567',
      }),
    );
    await renters.create(createRenterSchema.parse({ fullName: 'Ana López' }));

    const names = async (q: string) =>
      (await renters.list(query({ q }))).items.map((renter) => renter.fullName);

    expect(await names('juan pérez')).toEqual(['Juan Carlos Pérez']);
    expect(await names('012345678')).toEqual(['Juan Carlos Pérez']);
    expect(await names('71234567')).toEqual(['Juan Carlos Pérez']);
    expect(await names('juan ana')).toEqual([]);
    expect(await names('99')).toEqual([]);
  });
});
