import { API_ERROR_CODES, createRenterSchema, rentersQuerySchema } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { RenterUseCases } from './renter.usecases';
import { InMemoryRenterRepository } from './testing/in-memory-renter.repository';

const query = (filter: Record<string, string | number> = {}) => rentersQuerySchema.parse(filter);

const renter = (fullName: string, extra: Record<string, unknown> = {}) =>
  createRenterSchema.parse({
    fullName,
    documentId: '01234567-8',
    mobilePhone: '7777-8888',
    ...extra,
  });

describe('RenterUseCases (095)', () => {
  let repo: InMemoryRenterRepository;
  let renters: RenterUseCases;

  beforeEach(() => {
    repo = new InMemoryRenterRepository();
    renters = new RenterUseCases(repo);
  });

  it('un cliente bloqueado sale con ?blocked=true', async () => {
    await renters.create(renter('Ana López'));
    const blocked = await renters.create(renter('Beto Ruiz', { isBlocked: true, blockReason: 'Chocó' }));

    expect(
      (await renters.list(query({ blocked: 'true' }))).items.map((renter) => renter.id),
    ).toEqual([blocked.id]);
    expect(blocked.blockReason).toBe('Chocó');
  });

  it('pagina por nombre con el total del filtro entero (101)', async () => {
    for (const fullName of ['Carla Díaz', 'Ana López', 'Beto Ruiz']) {
      await renters.create(renter(fullName, { documentId: `DUI-${fullName}`, mobilePhone: '7000-0001' }));
    }

    const second = await renters.list(query({ page: 2, pageSize: 2 }));

    expect(second).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(second.items.map((renter) => renter.fullName)).toEqual(['Carla Díaz']);
  });

  it('desbloquear borra el motivo', async () => {
    const blocked = await renters.create(
      renter('Beto Ruiz', { isBlocked: true, blockReason: 'Chocó' }),
    );

    const updated = await renters.update(blocked.id, { isBlocked: false });

    expect(updated).toMatchObject({ isBlocked: false, blockReason: null });
  });

  it('se desactiva y ?active=false lo trae', async () => {
    const created = await renters.create(renter('Ana López'));

    await renters.update(created.id, { isActive: false });

    expect((await renters.list(query({ active: 'false' }))).items).toHaveLength(1);
    expect((await renters.list(query({ active: 'true' }))).items).toHaveLength(0);
  });

  it('importa las filas válidas y reporta las omitidas con su fila (RN-9)', async () => {
    const result = await renters.import({
      rows: [
        { Nombre: 'Ana López', DUI: '01234567-8', Celular: '7777-1111' },
        { Nombre: '', DUI: '9' },
        { Nombre: 'Carla Paz', Nacimiento: '31/02/1990' },
        { nombre: 'Diego Sol', dui: '87654321-0', celular: '7777-8888' },
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
});
