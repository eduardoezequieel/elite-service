import { FLEET_EXPENSE_TYPE_LABELS } from '@elite/shared';
import type { FleetExpenseRow, MaintenanceLog } from '@elite/shared';

/**
 * El historial de un carro (122): servicios y gastos en una sola lista, del más
 * nuevo al más viejo. Un servicio con costo tiene su gasto (`maintenanceLogId`);
 * sale una sola vez, como servicio. Puro.
 */

export type HistoryFilter = 'month' | 'all';

export type HistoryRow =
  | {
      kind: 'service';
      key: string;
      date: string;
      title: string;
      amount: string | null;
      odometerKm: number | null;
      /** El servicio que se borra. */
      logId: string;
    }
  | {
      kind: 'expense';
      key: string;
      date: string;
      title: string;
      amount: string;
      odometerKm: number | null;
      /** Lavado o multa: entra solo y no se toca. */
      automatic: boolean;
      expense: FleetExpenseRow;
    };

/** «Seguro», o lo que se escribió al anotarlo. */
export function expenseTitle(row: Pick<FleetExpenseRow, 'description' | 'type'>): string {
  const text = row.description?.trim();

  return text !== undefined && text !== '' ? text : FLEET_EXPENSE_TYPE_LABELS[row.type];
}

/** El primer día y el último del mes de `today`, para pedir los gastos del mes. */
export function monthRange(today: string): { from: string; to: string } {
  const [year = 0, month = 1] = today.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = today.slice(0, 7);

  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, '0')}` };
}

function inRange(date: string, range: { from: string; to: string } | null): boolean {
  return range === null || (date >= range.from && date <= range.to);
}

/**
 * Junta los servicios y los gastos cargados. Los gastos ya vienen filtrados
 * por el API; los servicios se recortan acá al rango, si hay uno.
 */
export function mergeHistory(
  logs: readonly MaintenanceLog[],
  expenses: readonly FleetExpenseRow[],
  range: { from: string; to: string } | null = null,
): HistoryRow[] {
  const loadedLogs = new Set(logs.map((log) => log.id));
  const services: HistoryRow[] = logs
    .filter((log) => inRange(log.performedAt, range))
    .map((log) => ({
      kind: 'service',
      key: `service:${log.id}`,
      date: log.performedAt,
      title: log.taskName ?? 'Servicio',
      amount: log.cost,
      odometerKm: log.odometerKm,
      logId: log.id,
    }));
  const spent: HistoryRow[] = expenses
    .filter((row) => row.maintenanceLogId === null || !loadedLogs.has(row.maintenanceLogId))
    .map((row) =>
      row.maintenanceLogId === null
        ? {
            kind: 'expense',
            key: `${row.source}:${row.id}`,
            date: row.incurredAt,
            title: expenseTitle(row),
            amount: row.amount,
            odometerKm: row.odometerKm,
            automatic: row.source !== 'MANUAL',
            expense: row,
          }
        : {
            // El gasto de un servicio que todavía no se cargó: sale como su servicio.
            kind: 'service',
            key: `service:${row.maintenanceLogId}`,
            date: row.incurredAt,
            title: expenseTitle(row),
            amount: row.amount,
            odometerKm: row.odometerKm,
            logId: row.maintenanceLogId,
          },
    );

  return [...services, ...spent]
    .map((row, index) => ({ row, index }))
    .sort((left, right) =>
      left.row.date === right.row.date
        ? left.index - right.index
        : left.row.date < right.row.date
          ? 1
          : -1,
    )
    .map(({ row }) => row);
}

/**
 * ¿Hay más para «Cargar más»? Los gastos, si el API tiene otra página. Los
 * servicios, si tiene otra y —con el filtro del mes— el más viejo cargado
 * todavía cae dentro del mes.
 */
export function historyHasMore(input: {
  logs: readonly MaintenanceLog[];
  logsHasMore: boolean;
  expensesHasMore: boolean;
  range: { from: string; to: string } | null;
}): boolean {
  if (input.expensesHasMore) return true;
  if (!input.logsHasMore) return false;
  if (input.range === null) return true;

  const oldest = input.logs.reduce<string | null>(
    (min, log) => (min === null || log.performedAt < min ? log.performedAt : min),
    null,
  );

  return oldest === null || oldest >= input.range.from;
}
