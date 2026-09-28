import type { InventoryItem } from '@elite/shared';

import { formatMoney, formatQuantity, itemReference } from './format';

/**
 * Una fila de la definición de un artículo, como la lista Catálogo → Productos
 * e Insumos (spec 068). Es la ficha de alta, no la existencia: esa vive en
 * `/inventory`.
 */
export interface ItemDefinitionRow {
  id: string;
  /** El número de `INV-0012`: 12. */
  reference: number;
  code: string;
  name: string;
  /** `null` = sin categoría. */
  category: string | null;
  unit: string;
  /** `$14.00`; `null` en un insumo, que no se vende (RN-1). */
  price: string | null;
  /** `null` = sin aviso de mínimo (`"0.000"`, RN-13). */
  minStock: string | null;
  isActive: boolean;
}

export function itemDefinitionRow(item: InventoryItem): ItemDefinitionRow {
  const min = formatQuantity(item.minStock);

  return {
    id: item.id,
    reference: itemReference(item.code),
    code: item.code,
    name: item.name,
    category: item.category?.name ?? null,
    unit: item.unit.trim(),
    price: item.kind === 'PRODUCT' ? formatMoney(item.price) : null,
    minStock: min === '0' ? null : min,
    isActive: item.isActive,
  };
}
