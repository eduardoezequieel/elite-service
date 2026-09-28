import type { InventoryItemOption } from '@elite/shared';

import type { ProductPick } from './product-lines';

/**
 * El bloque «Productos» del lavado por categoría (085): los chips, cuántos hay
 * en cada uno, cuánto llevás de cada uno y los grupos de una búsqueda.
 *
 * Suelto y sin React, como `product-lines.ts`: el orden de los chips y qué
 * cuenta cada número son reglas, no detalles de dibujo.
 */

/** La clave del chip de los productos que no tienen categoría. */
export const UNCATEGORIZED_KEY = 'none';

/** Lo que dice ese chip. */
export const UNCATEGORIZED_LABEL = 'Sin categoría';

/** Un chip de categoría. */
export interface CategoryChip {
  /** El id de la categoría, o `UNCATEGORIZED_KEY`. */
  key: string;
  name: string;
  /** Cuántos productos a la venta tiene (RN-2). */
  total: number;
  /** Cuánto llevás elegido de ella, en milésimas (RN-2). */
  picked: number;
}

/** Los productos de una categoría, con su título. */
export interface CategoryGroup {
  key: string;
  name: string;
  options: InventoryItemOption[];
}

/** La clave del chip al que pertenece un producto. */
export function categoryKeyOf(option: Pick<InventoryItemOption, 'category'>): string {
  return option.category?.id ?? UNCATEGORIZED_KEY;
}

function categoryNameOf(option: Pick<InventoryItemOption, 'category'>): string {
  return option.category?.name ?? UNCATEGORIZED_LABEL;
}

/** Alfabético por nombre; «Sin categoría» siempre al final (RN-3). */
function byCategory(a: { key: string; name: string }, b: { key: string; name: string }): number {
  const aNone = a.key === UNCATEGORIZED_KEY;
  const bNone = b.key === UNCATEGORIZED_KEY;

  if (aNone !== bNone) return aNone ? 1 : -1;

  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
}

/**
 * Los productos agrupados por categoría, en el orden de los chips, y dentro de
 * cada grupo por nombre.
 */
export function groupByCategory(options: readonly InventoryItemOption[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();

  for (const option of options) {
    const key = categoryKeyOf(option);
    const group = groups.get(key) ?? { key, name: categoryNameOf(option), options: [] };

    group.options.push(option);
    groups.set(key, group);
  }

  return [...groups.values()].sort(byCategory).map((group) => ({
    ...group,
    options: [...group.options].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
    ),
  }));
}

/**
 * Los chips, sacados de la lista completa de productos a la venta. Un elegido
 * que ya no está en la lista (inactivo) no suma a ningún chip.
 */
export function categoryChips(
  options: readonly InventoryItemOption[],
  picks: readonly ProductPick[],
): CategoryChip[] {
  const quantities = new Map(picks.map((pick) => [pick.inventoryItemId, pick.quantity]));

  return groupByCategory(options).map((group) => ({
    key: group.key,
    name: group.name,
    total: group.options.length,
    picked: group.options.reduce((sum, option) => sum + (quantities.get(option.id) ?? 0), 0),
  }));
}

/** Los productos de un chip. */
export function optionsInCategory(
  options: readonly InventoryItemOption[],
  key: string,
): InventoryItemOption[] {
  return options
    .filter((option) => categoryKeyOf(option) === key)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}
