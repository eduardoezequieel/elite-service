import { PERMISSIONS, type InventoryItemKind, type PermissionKey } from '@elite/shared';

/**
 * Las pestañas de `/settings/catalog` (spec 068): servicios del lavado y las
 * definiciones de artículo del inventario, en una sola pantalla. Los datos
 * siguen separados; solo se junta la pantalla.
 *
 * La pestaña viaja en la URL (`?tab=`) y cada una pide su permiso: Servicios
 * `services.read`, Productos e Insumos `inventory.read`. Sin pestaña en la URL
 * —o con una que el usuario no puede ver— manda la primera que sí puede.
 */

export const CATALOG_TABS = ['services', 'products', 'supplies'] as const;

export type CatalogTab = (typeof CATALOG_TABS)[number];

export const CATALOG_TAB_PARAM = 'tab';

const TAB_PERMISSION: Record<CatalogTab, PermissionKey> = {
  services: PERMISSIONS.services.actions.read.key,
  products: PERMISSIONS.inventory.actions.read.key,
  supplies: PERMISSIONS.inventory.actions.read.key,
};

export const CATALOG_TAB_LABELS: Record<CatalogTab, string> = {
  services: 'Servicios',
  products: 'Productos',
  supplies: 'Insumos',
};

/** Las claves que abren la pantalla: con una alcanza. */
export const CATALOG_PERMISSIONS: readonly PermissionKey[] = [...new Set(Object.values(TAB_PERMISSION))];

/** Las pestañas que este usuario puede ver, en el orden de la barra. */
export function allowedCatalogTabs(can: (key: PermissionKey) => boolean): CatalogTab[] {
  return CATALOG_TABS.filter((tab) => can(TAB_PERMISSION[tab]));
}

function isCatalogTab(value: string): value is CatalogTab {
  return (CATALOG_TABS as readonly string[]).includes(value);
}

/**
 * La pestaña que se muestra: la pedida si existe y se puede ver; si no, la
 * primera permitida. `null` si no puede ver ninguna.
 */
export function resolveCatalogTab(
  requested: string | string[] | null | undefined,
  allowed: readonly CatalogTab[],
): CatalogTab | null {
  const value = typeof requested === 'string' ? requested : null;
  if (value !== null && isCatalogTab(value) && allowed.includes(value)) return value;

  return allowed[0] ?? null;
}

/** Solo lo que no es el valor por defecto: la pestaña de entrada deja la URL limpia. */
export function catalogTabQuery(tab: CatalogTab, allowed: readonly CatalogTab[]): string {
  return tab === allowed[0] ? '' : `${CATALOG_TAB_PARAM}=${tab}`;
}

/** El tipo de artículo que lista una pestaña de inventario; `null` en Servicios. */
export function catalogTabKind(tab: CatalogTab): InventoryItemKind | null {
  if (tab === 'products') return 'PRODUCT';
  if (tab === 'supplies') return 'SUPPLY';

  return null;
}
