import type { Page } from '@elite/shared';

import { CIVIL_TZ } from '@/lib/civil-date';
import { formatQuantity, formatQuantityWithUnit } from '@/lib/quantity';

/**
 * Formato del inventario (spec 065).
 *
 * Las cantidades y el dinero se formatean en `lib/quantity.ts` y `lib/money.ts`
 * (spec 076); acá queda lo propio del inventario.
 */

const DATE = new Intl.DateTimeFormat('es-SV', {
  timeZone: CIVIL_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** «26 sept 2026», en la hora del taller. La hora va con `timeLabel` de `lib/civil-date`. */
export function formatMovementDate(iso: string): string {
  return DATE.format(new Date(iso)).replaceAll(/[\u202f\u00a0]/gu, ' ');
}

/** «Hay 4 litro», la frase que ve quien intenta sacar de más (RN-3). */
export function availableLabel(available: string, unit?: string): string {
  return `Hay ${unit === undefined ? formatQuantity(available) : formatQuantityWithUnit(available, unit)}`;
}

/** El número de referencia de un artículo: `INV-0012` → `12` (misma regla que el lavado). */
export function itemReference(code: string): number {
  const sequence = Number(code.slice(code.indexOf('-') + 1));

  return Number.isFinite(sequence) ? sequence : 0;
}

/** «1–50 de 120 movimientos». Una página vacía dice «0 movimientos». */
export function pageSummary<T>(page: Page<T>, noun: { one: string; many: string }): string {
  const word = page.total === 1 ? noun.one : noun.many;
  if (page.total === 0 || page.items.length === 0) return `${page.total} ${word}`;

  const first = (page.page - 1) * page.pageSize + 1;
  const last = first + page.items.length - 1;

  if (first === 1 && last === page.total) return `${page.total} ${word}`;

  return `${first}–${last} de ${page.total} ${word}`;
}

/** Cuántas páginas tiene el filtro. Siempre al menos una. */
export function pageCount<T>(page: Page<T>): number {
  return Math.max(1, Math.ceil(page.total / Math.max(page.pageSize, 1)));
}

/** El número de referencia de una fila dentro de una lista paginada. */
export function pagedReference<T>(page: Page<T> | undefined, index: number): number {
  if (page === undefined) return index + 1;

  return (page.page - 1) * page.pageSize + index + 1;
}
