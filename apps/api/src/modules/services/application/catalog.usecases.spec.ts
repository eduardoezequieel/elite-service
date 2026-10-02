import { API_ERROR_CODES } from '@elite/shared';
import type { ServiceCategorySummary, ServiceDetail } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import {
  CreateCategoryUseCase,
  CreateServiceUseCase,
  ListCategoriesUseCase,
  ListServicesPageUseCase,
  ListServicesUseCase,
  UpdateCategoryUseCase,
  UpdateServiceUseCase,
} from './catalog.usecases';
import { InMemoryServiceCatalogRepository } from './testing/in-memory-service-catalog.repository';

const washes: ServiceCategorySummary = {
  id: 'category-washes',
  name: 'Lavados',
  sortOrder: 0,
  isActive: true,
  isExtra: false,
};

const extras: ServiceCategorySummary = {
  id: 'category-extras',
  name: 'Extras',
  sortOrder: 1,
  isActive: true,
  isExtra: true,
};

const basicWash: ServiceDetail = {
  id: 'service-basic',
  code: 'LAV-001',
  name: 'Lavado básico',
  category: washes,
  defaultPrice: '8.00',
  taxRate: '0.13',
  isActive: true,
  prices: [{ bodyTypeId: 'body-pickup', price: '10.00' }],
};

const oldWax: ServiceDetail = {
  ...basicWash,
  id: 'service-wax',
  code: 'LAV-002',
  name: 'Encerado viejo',
  category: extras,
  isActive: false,
  prices: [],
};

function build() {
  return new InMemoryServiceCatalogRepository({
    categories: [extras, washes],
    services: [oldWax, basicWash],
  });
}

describe('ListCategoriesUseCase', () => {
  it('devuelve las categorías del repositorio, por orden', async () => {
    const categories = await new ListCategoriesUseCase(build()).execute({ page: 1, pageSize: 25 });

    expect(categories.items.map((category) => category.id)).toEqual([washes.id, extras.id]);
    expect(categories.total).toBe(2);
  });

  it('pagina y recorta por estado (102)', async () => {
    const catalog = new InMemoryServiceCatalogRepository({
      categories: [
        washes,
        extras,
        { ...extras, id: 'category-old', name: 'Viejas', sortOrder: 2, isActive: false },
      ],
    });
    const list = new ListCategoriesUseCase(catalog);

    const second = await list.execute({ page: 2, pageSize: 2 });
    expect(second).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(second.items.map((category) => category.id)).toEqual(['category-old']);

    const inactive = await list.execute({ active: false, page: 1, pageSize: 25 });
    expect(inactive.items.map((category) => category.id)).toEqual(['category-old']);
  });
});

describe('CreateCategoryUseCase', () => {
  it('sin `isExtra` la categoría nace como extra (067)', async () => {
    const catalog = build();

    const created = await new CreateCategoryUseCase(catalog).execute({ name: 'Motos' });

    expect(created.isExtra).toBe(true);
    expect(await catalog.findCategoryById(created.id)).toEqual(created);
  });

  it('respeta `isExtra: false` y el orden que se le pase', async () => {
    const created = await new CreateCategoryUseCase(build()).execute({
      name: 'Lavado premium',
      sortOrder: 5,
      isExtra: false,
    });

    expect(created).toMatchObject({ name: 'Lavado premium', sortOrder: 5, isExtra: false });
  });
});

describe('UpdateCategoryUseCase', () => {
  it('404 NOT_FOUND si la categoría no existe', async () => {
    const failure = await captureApiError(
      new UpdateCategoryUseCase(build()).execute('nada', { name: 'X' }),
    );

    expect(failure.status).toBe(404);
    expect(failure.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('cambia solo lo que viene', async () => {
    const updated = await new UpdateCategoryUseCase(build()).execute(washes.id, {
      isActive: false,
    });

    expect(updated).toEqual({ ...washes, isActive: false });
  });

  it('puede pasar una categoría a extra y cambiarle nombre y orden', async () => {
    const updated = await new UpdateCategoryUseCase(build()).execute(washes.id, {
      name: 'Lavados rápidos',
      sortOrder: 3,
      isExtra: true,
    });

    expect(updated).toEqual({ ...washes, name: 'Lavados rápidos', sortOrder: 3, isExtra: true });
  });
});

describe('ListServicesUseCase', () => {
  it('por omisión trae activos e inactivos', async () => {
    const services = await new ListServicesUseCase(build()).execute();

    expect(services.map((service) => service.id)).toEqual([basicWash.id, oldWax.id]);
  });

  it('la pista pide solo los activos (RN-4, RN-13)', async () => {
    const services = await new ListServicesUseCase(build()).execute(true);

    expect(services.map((service) => service.id)).toEqual([basicWash.id]);
  });
});

describe('ListServicesPageUseCase (102)', () => {
  const page = { page: 1, pageSize: 25 };

  it('pagina con el total de todos los servicios', async () => {
    const result = await new ListServicesPageUseCase(build()).execute({ page: 2, pageSize: 1 });

    expect(result).toMatchObject({ page: 2, pageSize: 1, total: 2 });
    expect(result.items.map((service) => service.id)).toEqual([oldWax.id]);
  });

  it('busca en nombre, código o categoría y recorta por categoría y estado', async () => {
    const list = new ListServicesPageUseCase(build());

    expect((await list.execute({ ...page, search: 'extras' })).items.map((s) => s.id)).toEqual([
      oldWax.id,
    ]);
    expect((await list.execute({ ...page, search: 'lav-001' })).items.map((s) => s.id)).toEqual([
      basicWash.id,
    ]);
    expect((await list.execute({ ...page, categoryId: washes.id })).items.map((s) => s.id)).toEqual(
      [basicWash.id],
    );
    expect((await list.execute({ ...page, active: false })).total).toBe(1);
  });
});

describe('CreateServiceUseCase', () => {
  it('crea el servicio con su matriz de precios', async () => {
    const catalog = build();

    const created = await new CreateServiceUseCase(catalog).execute({
      name: 'Pulido',
      categoryId: extras.id,
      defaultPrice: '25.00',
      prices: [{ bodyTypeId: 'body-pickup', price: '30.00' }],
    });

    expect(created).toMatchObject({
      name: 'Pulido',
      category: extras,
      defaultPrice: '25.00',
      isActive: true,
      prices: [{ bodyTypeId: 'body-pickup', price: '30.00' }],
    });
    expect(await catalog.findServiceById(created.id)).toEqual(created);
  });

  it('422 VALIDATION_ERROR si la categoría no existe, con el id en details', async () => {
    const catalog = build();

    const failure = await captureApiError(
      new CreateServiceUseCase(catalog).execute({
        name: 'Pulido',
        categoryId: 'category-ghost',
        defaultPrice: '25.00',
        prices: [],
      }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    expect(failure.body.details).toEqual({ categoryId: 'category-ghost' });
    expect(await catalog.listServices()).toHaveLength(2);
  });
});

describe('UpdateServiceUseCase', () => {
  it('404 NOT_FOUND si el servicio no existe', async () => {
    const failure = await captureApiError(
      new UpdateServiceUseCase(build()).execute('service-ghost', { name: 'X' }),
    );

    expect(failure.status).toBe(404);
    expect(failure.body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('422 VALIDATION_ERROR si se lo mueve a una categoría que no existe', async () => {
    const catalog = build();

    const failure = await captureApiError(
      new UpdateServiceUseCase(catalog).execute(basicWash.id, { categoryId: 'category-ghost' }),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.details).toEqual({ categoryId: 'category-ghost' });
    expect((await catalog.findServiceById(basicWash.id))?.category).toEqual(washes);
  });

  it('sin `prices` no toca la matriz (RN-2)', async () => {
    const updated = await new UpdateServiceUseCase(build()).execute(basicWash.id, {
      defaultPrice: '9.00',
    });

    expect(updated.defaultPrice).toBe('9.00');
    expect(updated.prices).toEqual(basicWash.prices);
  });

  it('con `prices: []` borra la matriz y deja el precio base (RN-3)', async () => {
    const updated = await new UpdateServiceUseCase(build()).execute(basicWash.id, { prices: [] });

    expect(updated.prices).toEqual([]);
    expect(updated.defaultPrice).toBe(basicWash.defaultPrice);
  });

  it('con `prices` reemplaza la matriz entera', async () => {
    const updated = await new UpdateServiceUseCase(build()).execute(basicWash.id, {
      prices: [{ bodyTypeId: 'body-sedan', price: '7.50' }],
    });

    expect(updated.prices).toEqual([{ bodyTypeId: 'body-sedan', price: '7.50' }]);
  });

  it('mueve de categoría, renombra y desactiva en un solo cambio', async () => {
    const updated = await new UpdateServiceUseCase(build()).execute(basicWash.id, {
      name: 'Lavado express',
      categoryId: extras.id,
      isActive: false,
    });

    expect(updated).toMatchObject({ name: 'Lavado express', category: extras, isActive: false });
  });
});
