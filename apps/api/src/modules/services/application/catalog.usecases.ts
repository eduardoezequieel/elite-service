import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateServiceCategoryInput,
  CreateServiceInput,
  ServiceCategorySummary,
  ServiceDetail,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
} from '@elite/shared';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

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
    throw new UnprocessableEntityException({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Esa categoría no existe.',
      details: { categoryId },
    });
  }
}

export class ListCategoriesUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  execute(): Promise<ServiceCategorySummary[]> {
    return this.catalog.listCategories();
  }
}

export class CreateCategoryUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  execute(input: CreateServiceCategoryInput): Promise<ServiceCategorySummary> {
    return this.catalog.createCategory(input);
  }
}

export class UpdateCategoryUseCase {
  constructor(private readonly catalog: ServiceCatalogRepository) {}

  async execute(id: string, input: UpdateServiceCategoryInput): Promise<ServiceCategorySummary> {
    if ((await this.catalog.findCategoryById(id)) === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Esa categoría no existe.',
      });
    }

    const changes: CategoryChanges = {};

    if (input.name !== undefined) changes.name = input.name;
    if (input.sortOrder !== undefined) changes.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) changes.isActive = input.isActive;

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
      throw new NotFoundException({
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
