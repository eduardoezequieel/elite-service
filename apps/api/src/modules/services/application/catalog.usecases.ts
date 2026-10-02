import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  Page,
  ServiceCategoriesQuery,
  ServiceCategorySummary,
  ServiceDetail,
  ServicesQuery,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
} from '@elite/shared';

import { NotFoundError, ValidationError } from '../../../common/errors/application-error';
import type {
  CategoryChanges,
  ServiceCatalogRepository,
  ServiceChanges,
} from './ports/service-catalog.repository';

async function assertCategoryExists(
  catalog: ServiceCatalogRepository,
  categoryId: string,
): Promise<void> {
  if (!(await catalog.categoryExists(categoryId))) {
    throw new ValidationError({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Esa categoría no existe.',
      details: { categoryId },
    });
  }
}

export class ListCategoriesUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  /** `GET /service-categories`, de a una página (102). */
  execute(query: ServiceCategoriesQuery): Promise<Page<ServiceCategorySummary>> {
    return this.catalog.listCategories(query);
  }
}

export class CreateCategoryUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  execute(input: CreateServiceCategoryInput): Promise<ServiceCategorySummary> {
    // Sin valor cuenta como extra (067): lo raro es la categoria del lavado principal.
    return this.catalog.createCategory({
      name: input.name,
      sortOrder: input.sortOrder,
      isExtra: input.isExtra ?? true,
    });
  }
}

export class UpdateCategoryUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  async execute(id: string, input: UpdateServiceCategoryInput): Promise<ServiceCategorySummary> {
    if ((await this.catalog.findCategoryById(id)) === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa categoría no existe.',
      });
    }

    const changes: CategoryChanges = {};

    if (input.name !== undefined) changes.name = input.name;
    if (input.sortOrder !== undefined) changes.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) changes.isActive = input.isActive;
    if (input.isExtra !== undefined) changes.isExtra = input.isExtra;

    return this.catalog.updateCategory(id, changes);
  }
}

/**
 * `GET /services`. La pista pide solo los activos: un servicio desactivado no
 * se puede agregar a un ticket nuevo, pero sigue existiendo en los viejos
 * gracias al snapshot de la linea (RN-4, RN-13).
 */
export class ListServicesUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  execute(onlyActive = false): Promise<ServiceDetail[]> {
    return this.catalog.listServices(onlyActive);
  }
}

/** `GET /services` de oficina, con filtros y de a una página (102). */
export class ListServicesPageUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  execute(query: ServicesQuery): Promise<Page<ServiceDetail>> {
    return this.catalog.listServicesPage(query);
  }
}

export class CreateServiceUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  async execute(input: CreateServiceInput): Promise<ServiceDetail> {
    await assertCategoryExists(this.catalog, input.categoryId);

    return this.catalog.createService({
      name: input.name,
      categoryId: input.categoryId,
      defaultPrice: input.defaultPrice,
      prices: [...input.prices],
    });
  }
}

export class UpdateServiceUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  async execute(id: string, input: UpdateServiceInput): Promise<ServiceDetail> {
    if ((await this.catalog.findServiceById(id)) === null) {
      throw new NotFoundError({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese servicio no existe.',
      });
    }

    if (input.categoryId !== undefined) {
      await assertCategoryExists(this.catalog, input.categoryId);
    }

    const changes: ServiceChanges = {};

    if (input.name !== undefined) changes.name = input.name;
    if (input.categoryId !== undefined) changes.categoryId = input.categoryId;
    if (input.defaultPrice !== undefined) changes.defaultPrice = input.defaultPrice;
    if (input.isActive !== undefined) changes.isActive = input.isActive;
    // Ausente y vacia son cosas distintas: ausente no toca la matriz, vacia la
    // borra y deja al servicio usando siempre su precio base (RN-2, RN-3).
    if (input.prices !== undefined) changes.prices = [...input.prices];

    return this.catalog.updateService(id, changes);
  }
}
