import type {
  CreateInventoryDeliveryInput,
  InventoryEmployeeOption,
  InventoryItem,
  InventoryItemKind,
} from '@elite/shared';

import { formatQuantity, milliToQuantity, quantityMilli } from '@/lib/quantity';
import { toCents } from '@/lib/money';

/**
 * «Entregar a empleado» (spec 091): a quién, qué y cuánto. Suelto y sin React,
 * como `product-browse.ts` del lavado: qué movimiento sale de cada artículo,
 * cómo se agrupan los chips y cuánto vale lo que se lleva son reglas, no
 * detalles de dibujo.
 */

/** Una unidad, en milésimas: lo que suma o resta el `− N +`. */
export const ONE_UNIT_MILLI = 1000;

/** Una línea de la entrega. La cantidad es el texto del campo: se puede estar escribiendo. */
export interface DeliveryLine {
  itemId: string;
  quantity: string;
}

/**
 * Qué queda en el kardex (091 RN-1): un producto se anota como consumo, a
 * precio de venta y sin cobrar; un insumo se despacha. No se elige.
 */
export function deliveryMovementOf(kind: InventoryItemKind): 'CONSUMPTION' | 'DISPATCH' {
  return kind === 'PRODUCT' ? 'CONSUMPTION' : 'DISPATCH';
}

/** Sin tildes ni mayúsculas: «jose» encuentra a José. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Los empleados cuyo nombre contiene lo escrito, en el orden de la lista. */
export function employeesMatching(
  employees: readonly InventoryEmployeeOption[],
  term: string,
): InventoryEmployeeOption[] {
  const folded = foldText(term);
  if (folded === '') return [...employees];

  return employees.filter((employee) => foldText(employee.fullName).includes(folded));
}

/** «Luis Martínez» → «LM». */
export function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('es-SV'))
    .join('');
}

/** La cantidad de una línea en milésimas; lo que no es un número cuenta como cero. */
export function lineMilli(line: Pick<DeliveryLine, 'quantity'> | undefined): number {
  if (line === undefined) return 0;
  const milli = quantityMilli(line.quantity);

  return milli === null || milli < 0 ? 0 : milli;
}

/**
 * El `− N +` de una fila: suma o resta una unidad. En cero la línea se va; una
 * fila sin línea que sube entra al final, que es donde se ve lo elegido.
 */
export function stepLine(
  lines: readonly DeliveryLine[],
  itemId: string,
  deltaMilli: number,
): DeliveryLine[] {
  const current = lines.find((line) => line.itemId === itemId);
  const next = lineMilli(current) + deltaMilli;

  if (next <= 0) return lines.filter((line) => line.itemId !== itemId);

  // Lo que muestra el número de la fila: «2», no «2.000».
  const quantity = formatQuantity(milliToQuantity(next));
  if (current === undefined) return [...lines, { itemId, quantity }];

  return lines.map((line) => (line.itemId === itemId ? { ...line, quantity } : line));
}

/** Lo que se escribe a mano en el número de una fila: se guarda tal cual. */
export function typeLine(
  lines: readonly DeliveryLine[],
  itemId: string,
  quantity: string,
): DeliveryLine[] {
  return lines.map((line) => (line.itemId === itemId ? { ...line, quantity } : line));
}

/** La línea pide más de lo que hay. */
export function isShort(
  item: Pick<InventoryItem, 'stockOnHand'>,
  line: DeliveryLine | undefined,
): boolean {
  const stock = quantityMilli(item.stockOnHand) ?? 0;

  return lineMilli(line) > stock;
}

/** Cuánto queda si se entrega la línea, en milésimas. */
export function leftAfter(
  item: Pick<InventoryItem, 'stockOnHand'>,
  line: DeliveryLine | undefined,
): number {
  return (quantityMilli(item.stockOnHand) ?? 0) - lineMilli(line);
}

/** El valor a precio de venta de una línea de producto, en centavos (070 RN-4). */
export function lineValueCents(
  item: Pick<InventoryItem, 'price'>,
  line: DeliveryLine | undefined,
): number {
  const cents = toCents(item.price) ?? 0;

  return Math.round((lineMilli(line) * cents) / 1000);
}

export interface DeliverySummary {
  /** Cuántos productos van como consumo, y cuánto valen. */
  consumption: { count: number; cents: number };
  /** Cuántos insumos van como despacho. */
  dispatch: { count: number };
}

/** Lo que dice el pie del diálogo: cuánto es consumo, cuánto despacho. */
export function deliverySummary(
  lines: readonly DeliveryLine[],
  itemOf: (id: string) => InventoryItem | undefined,
): DeliverySummary {
  const summary: DeliverySummary = { consumption: { count: 0, cents: 0 }, dispatch: { count: 0 } };

  for (const line of lines) {
    const item = itemOf(line.itemId);
    if (item === undefined || lineMilli(line) === 0) continue;

    if (deliveryMovementOf(item.kind) === 'CONSUMPTION') {
      summary.consumption.count += 1;
      summary.consumption.cents += lineValueCents(item, line);
    } else {
      summary.dispatch.count += 1;
    }
  }

  return summary;
}

/** Lo que va al API: solo las líneas con cantidad, y la nota si hay. */
export function deliveryDraft(
  employeeId: string,
  note: string,
  lines: readonly DeliveryLine[],
): CreateInventoryDeliveryInput {
  const trimmed = note.trim();

  return {
    employeeId,
    ...(trimmed === '' ? {} : { note: trimmed }),
    lines: lines
      .filter((line) => lineMilli(line) > 0)
      .map((line) => ({ itemId: line.itemId, quantity: milliToQuantity(lineMilli(line)) })),
  };
}

// --- chips de categoría (085) sobre productos e insumos ---

/** La clave del chip: tipo y categoría, porque las categorías son por tipo (072). */
export function categoryKeyOf(item: Pick<InventoryItem, 'kind' | 'category'>): string {
  return `${item.kind}:${item.category?.id ?? 'none'}`;
}

export interface ItemGroup {
  key: string;
  kind: InventoryItemKind;
  name: string;
  items: InventoryItem[];
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

/**
 * Los artículos por categoría: productos antes que insumos, categorías en
 * orden alfabético con «Sin categoría» al final (085 RN-3), y adentro por nombre.
 */
export function groupItems(items: readonly InventoryItem[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();

  for (const item of items) {
    const key = categoryKeyOf(item);
    const group = groups.get(key) ?? {
      key,
      kind: item.kind,
      name: item.category?.name ?? 'Sin categoría',
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()]
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'PRODUCT' ? -1 : 1;
      const aNone = a.key.endsWith(':none');
      const bNone = b.key.endsWith(':none');
      if (aNone !== bNone) return aNone ? 1 : -1;

      return byName(a, b);
    })
    .map((group) => ({ ...group, items: [...group.items].sort(byName) }));
}

export interface ItemChip {
  key: string;
  kind: InventoryItemKind;
  name: string;
  /** Cuántos artículos tiene. */
  total: number;
  /** Cuánto llevás de ella, en milésimas. */
  picked: number;
}

/** Los chips, sacados de la lista completa, con lo elegido de cada uno. */
export function itemChips(
  items: readonly InventoryItem[],
  lines: readonly DeliveryLine[],
): ItemChip[] {
  const quantities = new Map(lines.map((line) => [line.itemId, lineMilli(line)]));

  return groupItems(items).map((group) => ({
    key: group.key,
    kind: group.kind,
    name: group.name,
    total: group.items.length,
    picked: group.items.reduce((sum, item) => sum + (quantities.get(item.id) ?? 0), 0),
  }));
}
