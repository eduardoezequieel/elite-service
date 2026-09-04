import type { ServiceCategorySummary, ServiceDetail } from '@elite/shared';

/** Una celda de la matriz. El precio viaja como cadena decimal. */
export interface PriceRow {
  bodyTypeId: string;
  price: string;
}

export interface NewServiceData {
  name: string;
  categoryId: string;
  defaultPrice: string;
  prices: PriceRow[];
}

export interface ServiceChanges {
  name?: string;
  categoryId?: string;
  defaultPrice?: string;
  isActive?: boolean;
  /** Si viene, **reemplaza** la matriz completa. Si no viene, no se toca. */
  prices?: PriceRow[];
}

export interface NewCategoryData {
  name: string;
  sortOrder?: number;
}

export interface CategoryChanges {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Puerto del catalogo de carwash.
 *
 * Todas las lecturas son del area `CARWASH`: esta spec no ofrece `WORKSHOP`
 * (RN-1). El area no es un parametro del puerto para que no se cuele por
 * descuido un listado del taller en una pantalla de lavado.
 */
export interface ServiceCatalogRepository {
  listCategories(): Promise<ServiceCategorySummary[]>;
  categoryExists(id: string): Promise<boolean>;
  createCategory(data: NewCategoryData): Promise<ServiceCategorySummary>;
  updateCategory(id: string, changes: CategoryChanges): Promise<ServiceCategorySummary>;
  findCategoryById(id: string): Promise<ServiceCategorySummary | null>;

  /** Servicios con su matriz. `onlyActive` es lo que ve la pista. */
  listServices(onlyActive?: boolean): Promise<ServiceDetail[]>;
  findServiceById(id: string): Promise<ServiceDetail | null>;
  createService(data: NewServiceData): Promise<ServiceDetail>;
  updateService(id: string, changes: ServiceChanges): Promise<ServiceDetail>;
}

export const SERVICE_CATALOG_REPOSITORY = Symbol('services.ServiceCatalogRepository');
