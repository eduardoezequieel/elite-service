import type { CreateInventoryEntriesInput, InventoryItemKind } from '@elite/shared';

import { toCents } from '@/lib/money';
import { milliToQuantity, quantityMilli } from '@/lib/quantity';

/**
 * «Registrar entrada» paso a paso (spec 091): una pregunta por pantalla. El
 * orden de los pasos, adónde vuelve «Atrás» y cómo se arma lo que va al API
 * viven acá, sin React.
 */

export const ENTRY_STEPS = [
  { key: 'kind', label: 'Tipo' },
  { key: 'item', label: 'Artículo' },
  { key: 'quantity', label: 'Cantidad' },
  { key: 'cost', label: 'Te costó' },
  { key: 'review', label: 'Revisar' },
] as const;

export type EntryStep = (typeof ENTRY_STEPS)[number]['key'];

/** Una línea de la entrada. Cantidad y costo son el texto del campo. */
export interface EntryLine {
  itemId: string;
  quantity: string;
  unitCost: string;
}

/** La posición del paso, para la barra de progreso: 0 a 4. */
export function stepIndex(step: EntryStep): number {
  return ENTRY_STEPS.findIndex((candidate) => candidate.key === step);
}

/**
 * Adónde vuelve «Atrás». Editando una línea desde «Revisar», la cantidad vuelve
 * a «Revisar»: el artículo ya está elegido. Tipo y Revisar no tienen atrás.
 */
export function backStepOf(step: EntryStep, editing: boolean): EntryStep | null {
  switch (step) {
    case 'item':
      return 'kind';
    case 'quantity':
      return editing ? 'review' : 'item';
    case 'cost':
      return 'quantity';
    default:
      return null;
  }
}

/** «producto» / «insumos». */
export function kindWord(kind: InventoryItemKind, plural = false): string {
  if (kind === 'PRODUCT') return plural ? 'productos' : 'producto';

  return plural ? 'insumos' : 'insumo';
}

/**
 * Suma la línea a la entrada. Un artículo va una sola vez (091 RN-3): si ya
 * estaba, se reemplaza donde estaba.
 */
export function upsertLine(lines: readonly EntryLine[], line: EntryLine): EntryLine[] {
  const index = lines.findIndex((candidate) => candidate.itemId === line.itemId);
  if (index < 0) return [...lines, line];

  return lines.map((candidate, position) => (position === index ? line : candidate));
}

/** La cantidad en milésimas, o `null` si no es un número mayor que cero. */
export function quantityOf(text: string): number | null {
  const milli = quantityMilli(text);

  return milli === null || milli <= 0 ? null : milli;
}

/** El costo en centavos; vacío es «sin costo» (`null`), y lo ilegible es `undefined`. */
export function unitCostOf(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const cents = toCents(text.trim().replace(',', '.'));

  return cents === null || cents < 0 ? undefined : cents;
}

/** Lo que cuesta la línea, en centavos, si trae costo. */
export function lineCostCents(line: EntryLine): number | null {
  const milli = quantityOf(line.quantity);
  const cents = unitCostOf(line.unitCost);
  if (milli === null || cents === null || cents === undefined) return null;

  return Math.round((milli * cents) / 1000);
}

/** El total de lo que trae costo, en centavos. */
export function entryTotalCents(lines: readonly EntryLine[]): number {
  return lines.reduce((sum, line) => sum + (lineCostCents(line) ?? 0), 0);
}

/**
 * El costo promedio después de la entrada, en centavos (065 RN-11): ponderado
 * por existencia. Con la existencia en cero o menos manda el costo nuevo.
 */
export function averageAfter(
  stockOnHand: string,
  averageCost: string,
  quantityMilliIn: number,
  unitCostCents: number,
): number {
  const stock = Math.max(quantityMilli(stockOnHand) ?? 0, 0);
  const average = toCents(averageCost) ?? 0;
  if (stock + quantityMilliIn <= 0) return unitCostCents;

  return Math.round(
    (stock * average + quantityMilliIn * unitCostCents) / (stock + quantityMilliIn),
  );
}

/** Lo que va a `POST /inventory/entries`: las líneas con cantidad y la referencia si hay. */
export function entriesDraft(
  lines: readonly EntryLine[],
  reference: string,
): CreateInventoryEntriesInput {
  const trimmed = reference.trim();

  return {
    ...(trimmed === '' ? {} : { reference: trimmed }),
    lines: lines.flatMap((line) => {
      const milli = quantityOf(line.quantity);
      if (milli === null) return [];
      const cents = unitCostOf(line.unitCost);

      return [
        {
          itemId: line.itemId,
          quantity: milliToQuantity(milli),
          ...(typeof cents === 'number' ? { unitCost: (cents / 100).toFixed(2) } : {}),
        },
      ];
    }),
  };
}
