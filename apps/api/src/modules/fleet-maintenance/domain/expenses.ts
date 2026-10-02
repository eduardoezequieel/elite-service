import { centsToMoney, moneyToCents } from '@elite/shared';
import type { FleetExpenseRow, FleetExpenseType } from '@elite/shared';

/**
 * Los gastos por carro (099 RN-3, RN-4): reglas puras para juntar los tres
 * orígenes en una sola lista.
 */

/** Orden de los orígenes en un mismo día: lo anotado primero. */
const SOURCE_ORDER = { MANUAL: 0, CARWASH: 1, FINE: 2 } as const;

/** Un lavado del carwash entra como `WASH`; una multa no cargada, como `FINE`. */
export function includesAutomatic(type: FleetExpenseType | undefined, of: 'WASH' | 'FINE') {
  return type === undefined || type === of;
}

/** Junta las filas: la más reciente arriba, en un orden estable para paginar (101). */
export function mergeExpenses(...sources: readonly FleetExpenseRow[][]): FleetExpenseRow[] {
  return sources
    .flat()
    .sort(
      (left, right) =>
        right.incurredAt.localeCompare(left.incurredAt) ||
        SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source] ||
        left.id.localeCompare(right.id),
    );
}

export function sumExpenses(rows: readonly Pick<FleetExpenseRow, 'amount'>[]): string {
  return centsToMoney(rows.reduce((sum, row) => sum + moneyToCents(row.amount), 0));
}

/** Un gasto se edita o se borra solo si es manual y no sale de un servicio (RN-3). */
export function isEditableExpense(
  row: Pick<FleetExpenseRow, 'source' | 'maintenanceLogId'>,
): boolean {
  return row.source === 'MANUAL' && row.maintenanceLogId === null;
}
