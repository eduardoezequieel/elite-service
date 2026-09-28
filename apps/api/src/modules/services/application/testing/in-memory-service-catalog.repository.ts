import type { ServiceCategorySummary, ServiceDetail } from '@elite/shared';

import type {
  CategoryChanges,
  NewCategoryData,
  NewServiceData,
  ServiceCatalogRepository,
  ServiceChanges,
} from '../ports/service-catalog.repository';

/**
 * Repositorio en memoria para los tests. Mismo contrato que el de Prisma:
 * categorías por `sortOrder` y nombre, servicios por el orden de su categoría
 * y su código, y `prices` reemplaza la matriz entera cuando viene.
 */
export class InMemoryServiceCatalogRepository implements ServiceCatalogRepository {
  private readonly categories = new Map<string, ServiceCategorySummary>();
  private readonly services = new Map<string, ServiceDetail>();
  private categorySequence = 0;
  private serviceSequence = 0;

  constructor(seed: { categories?: ServiceCategorySummary[]; services?: ServiceDetail[] } = {}) {
    for (const category of seed.categories ?? []) this.categories.set(category.id, category);
    for (const service of seed.services ?? []) this.services.set(service.id, service);
  }

  async listCategories(): Promise<ServiceCategorySummary[]> {
    return [...this.categories.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }

  async categoryExists(id: string): Promise<boolean> {
    return this.categories.has(id);
  }

  async createCategory(data: NewCategoryData): Promise<ServiceCategorySummary> {
    const category: ServiceCategorySummary = {
      id: `category-${++this.categorySequence}`,
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
      isActive: true,
      isExtra: data.isExtra,
    };

    this.categories.set(category.id, category);

    return category;
  }

  async updateCategory(id: string, changes: CategoryChanges): Promise<ServiceCategorySummary> {
    const current = this.categories.get(id);

    if (current === undefined) throw new Error(`No existe la categoría ${id}`);

    const updated = { ...current, ...changes };

    this.categories.set(id, updated);

    return updated;
  }

  async findCategoryById(id: string): Promise<ServiceCategorySummary | null> {
    return this.categories.get(id) ?? null;
  }

  async listServices(onlyActive = false): Promise<ServiceDetail[]> {
    return [...this.services.values()]
      .map((service) => this.withCurrentCategory(service))
      .filter((service) => !onlyActive || service.isActive)
      .sort(
        (a, b) => a.category.sortOrder - b.category.sortOrder || a.code.localeCompare(b.code),
      );
  }

  async findServiceById(id: string): Promise<ServiceDetail | null> {
    const service = this.services.get(id);

    return service === undefined ? null : this.withCurrentCategory(service);
  }

  async createService(data: NewServiceData): Promise<ServiceDetail> {
    const sequence = ++this.serviceSequence;
    const service: ServiceDetail = {
      id: `service-${sequence}`,
      code: `LAV-${String(sequence).padStart(3, '0')}`,
      name: data.name,
      category: this.categoryOrThrow(data.categoryId),
      defaultPrice: data.defaultPrice,
      taxRate: '0.13',
      isActive: true,
      prices: data.prices.map((row) => ({ ...row })),
    };

    this.services.set(service.id, service);

    return service;
  }

  async updateService(id: string, changes: ServiceChanges): Promise<ServiceDetail> {
    const current = this.services.get(id);

    if (current === undefined) throw new Error(`No existe el servicio ${id}`);

    const updated: ServiceDetail = {
      ...current,
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.defaultPrice === undefined ? {} : { defaultPrice: changes.defaultPrice }),
      ...(changes.isActive === undefined ? {} : { isActive: changes.isActive }),
      ...(changes.categoryId === undefined
        ? {}
        : { category: this.categoryOrThrow(changes.categoryId) }),
      ...(changes.prices === undefined
        ? {}
        : { prices: changes.prices.map((row) => ({ ...row })) }),
    };

    this.services.set(id, updated);

    return this.withCurrentCategory(updated);
  }

  private categoryOrThrow(id: string): ServiceCategorySummary {
    const category = this.categories.get(id);

    if (category === undefined) throw new Error(`No existe la categoría ${id}`);

    return category;
  }

  /** Como el `include` de Prisma: la categoría se lee al momento, no se copia. */
  private withCurrentCategory(service: ServiceDetail): ServiceDetail {
    return { ...service, category: this.categories.get(service.category.id) ?? service.category };
  }
}
