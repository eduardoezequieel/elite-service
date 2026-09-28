import type { InventoryItem, InventoryItemKind } from '@elite/shared';

import { milliToQuantity, quantityMilli } from './format';

/**
 * Lo que escribe la persona en los diálogos del inventario, y cómo se vuelve
 * el cuerpo del pedido (spec 065).
 *
 * El formulario trabaja con texto —un campo vacío es `''`— y el contrato con
 * campos opcionales. Estas funciones hacen el puente antes de que el schema de
 * `@elite/shared` valide, así que la regla sigue siendo una sola: la del API.
 */

export interface ItemFormValues {
  kind: InventoryItemKind;
  name: string;
  /** `''` = sin categoría. */
  categoryId: string;
  unit: string;
  /** Solo producto. En un insumo ni se muestra (RN-1). */
  price: string;
  minStock: string;
  barcode: string;
  isActive: boolean;
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  kind: 'PRODUCT',
  name: '',
  categoryId: '',
  unit: 'unidad',
  price: '',
  minStock: '',
  barcode: '',
  isActive: true,
};

/** Quita los ceros de más de una cantidad para ponerla en un campo: `"5.000"` → `"5"`. */
function quantityForField(value: string): string {
  const milli = quantityMilli(value);
  if (milli === null || milli === 0) return '';

  return milliToQuantity(milli).replace(/\.?0+$/, '');
}

/** Los valores de un artículo existente, para editarlo. */
export function itemFormValuesOf(item: InventoryItem): ItemFormValues {
  return {
    kind: item.kind,
    name: item.name,
    categoryId: item.category?.id ?? '',
    unit: item.unit,
    price: item.kind === 'PRODUCT' ? item.price : '',
    minStock: quantityForField(item.minStock),
    barcode: item.barcode ?? '',
    isActive: item.isActive,
  };
}

/**
 * El alta. Un insumo no manda precio: el API lo guarda en `0` (RN-1) y, si
 * llegara uno, respondería `SUPPLY_HAS_PRICE`.
 */
export function createItemDraft(values: ItemFormValues): Record<string, string> {
  const draft: Record<string, string> = {
    kind: values.kind,
    name: values.name,
  };

  if (values.unit.trim() !== '') draft.unit = values.unit;
  if (values.categoryId !== '') draft.categoryId = values.categoryId;
  if (values.kind === 'PRODUCT') draft.price = values.price;
  if (values.minStock.trim() !== '') draft.minStock = values.minStock;
  if (values.barcode.trim() !== '') draft.barcode = values.barcode;

  return draft;
}

/**
 * La edición. `kind` no viaja (RN-1). Vaciar categoría o código de barras los
 * quita (`null`); vaciar el mínimo lo deja en cero, que es «sin alerta».
 */
export function updateItemDraft(values: ItemFormValues): Record<string, string | boolean | null> {
  const draft: Record<string, string | boolean | null> = {
    name: values.name,
    unit: values.unit,
    categoryId: values.categoryId === '' ? null : values.categoryId,
    minStock: values.minStock.trim() === '' ? '0' : values.minStock,
    barcode: values.barcode.trim() === '' ? null : values.barcode,
    isActive: values.isActive,
  };

  if (values.kind === 'PRODUCT') draft.price = values.price;

  return draft;
}

// --- entrada, despacho, ajuste ---

export interface EntryFormValues {
  quantity: string;
  unitCost: string;
  reference: string;
}

export function entryDraft(values: EntryFormValues): Record<string, string> {
  const draft: Record<string, string> = { quantity: values.quantity };
  if (values.unitCost.trim() !== '') draft.unitCost = values.unitCost;
  if (values.reference.trim() !== '') draft.reference = values.reference;

  return draft;
}

export interface DispatchFormValues {
  quantity: string;
  employeeId: string;
  note: string;
}

export function dispatchDraft(values: DispatchFormValues): Record<string, string> {
  const draft: Record<string, string> = {
    quantity: values.quantity,
    employeeId: values.employeeId,
  };
  if (values.note.trim() !== '') draft.note = values.note;

  return draft;
}

/** El consumo de un empleado (070) pide lo mismo que el despacho: cantidad, quién y nota. */
export type ConsumptionFormValues = DispatchFormValues;

export function consumptionDraft(values: ConsumptionFormValues): Record<string, string> {
  return dispatchDraft(values);
}

export type AdjustmentSign = 'add' | 'remove';

export interface AdjustmentFormValues {
  sign: AdjustmentSign;
  /** Siempre sin signo: el signo lo pone el selector. */
  quantity: string;
  reason: string;
}

export function adjustmentDraft(values: AdjustmentFormValues): Record<string, string> {
  const magnitude = values.quantity.trim().replace(/^[+-]/, '');

  return {
    quantity: values.sign === 'remove' && magnitude !== '' ? `-${magnitude}` : magnitude,
    reason: values.reason,
  };
}

/**
 * La existencia que quedaría después de un movimiento, en milésimas, o `null`
 * si la cantidad todavía no es un número. Sirve para avisar antes de mandar.
 */
export function stockAfter(stockOnHand: string, delta: string): number | null {
  const current = quantityMilli(stockOnHand);
  const change = quantityMilli(delta);
  if (current === null || change === null) return null;

  return current + change;
}
