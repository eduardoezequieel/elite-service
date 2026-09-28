import type { InventoryItemKind } from '@elite/shared';

/**
 * El tipo de las categorías del inventario en la URL (spec 072):
 * `/settings/inventory/categories?kind=products|supplies`, las mismas palabras
 * que las pestañas de Catálogo. Sin tipo, o con uno que no existe, productos.
 */

export const CATEGORY_KIND_PARAM = 'kind';

export type CategoryKindParam = 'products' | 'supplies';

export function categoryKindFromParam(
  value: string | string[] | null | undefined,
): InventoryItemKind {
  return value === 'supplies' ? 'SUPPLY' : 'PRODUCT';
}

export function categoryKindParam(kind: InventoryItemKind): CategoryKindParam {
  return kind === 'SUPPLY' ? 'supplies' : 'products';
}

/** El enlace a las categorías de un tipo. */
export function categoriesHref(kind: InventoryItemKind): string {
  return `/settings/inventory/categories?${CATEGORY_KIND_PARAM}=${categoryKindParam(kind)}`;
}
