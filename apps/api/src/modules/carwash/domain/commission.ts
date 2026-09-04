import type { CommissionReport } from '@elite/shared';

import type { Cents } from './money';
import { toDecimalString } from './money';

/** Zona del taller. El reporte recorta `chargedAt` a este calendario, no al UTC. */
export const BUSINESS_TIME_ZONE = 'America/El_Salvador';

/**
 * Comisión de un ticket, en centavos, sobre el total final (suma de
 * `unitPrice`). Idéntica al legado: tramos fijos hasta $40 y 12 % a partir de
 * ahí, con `Math.round` al centavo más cercano (009 RN-2).
 *
 * El salto $39.99 → $4 / $40 → $4.80 se copia a propósito.
 */
export function commissionFor(total: Cents): Cents {
  if (total < 1400) return 0;
  if (total < 2000) return 100;
  if (total < 2500) return 200;
  if (total < 3500) return 300;
  if (total < 4000) return 400;

  return Math.round((total * 12) / 100);
}

/**
 * Parte `total` entre `n` lavadores en centavos: los primeros `n − 1` reciben
 * `floor(total / n)` y el último el resto, para que la suma dé exacto (009 RN-4).
 *
 * `n = 0` no produce partes: no hay a quién asignar.
 */
export function splitCommission(total: Cents, n: number): Cents[] {
  if (n <= 0) return [];

  const share = Math.floor(total / n);
  const parts = Array.from({ length: n }, () => share);

  parts[n - 1] = total - share * (n - 1);

  return parts;
}

/** Hoy civil en la zona del taller, `YYYY-MM-DD`. */
export function civilDateInBusinessZone(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIME_ZONE });
}

/** Completa `from`/`to` con hoy cuando no vienen. */
export function resolveCommissionRange(from?: string, to?: string): { from: string; to: string } {
  const today = civilDateInBusinessZone();

  return { from: from ?? today, to: to ?? today };
}

/** Una entrada persistida, ya traducida a centavos, lista para agrupar. */
export interface CommissionEntryRecord {
  employeeId: string;
  fullName: string;
  isActive: boolean;
  amount: Cents;
  workOrderId: string;
  ticketTotal: Cents;
  washerCount: number;
  /** Posición en el conjunto, 0-based: el último se lleva el resto del total. */
  washerIndex: number;
}

/** Ticket PAID sin lavadores: la comisión se calculó y no se asignó. */
export interface UnassignedCommissionRecord {
  commissionTotal: Cents;
}

/**
 * Arma el reporte a partir de las filas persistidas. No vuelve a aplicar la
 * fórmula de tramos: suma lo que ya se congeló al cobrar (009 RN-8).
 */
export function buildCommissionReport(
  range: { from: string; to: string },
  entries: readonly CommissionEntryRecord[],
  unassigned: readonly UnassignedCommissionRecord[],
): CommissionReport {
  const byEmployee = new Map<
    string,
    {
      employeeId: string;
      fullName: string;
      isActive: boolean;
      tickets: Set<string>;
      salesAttributed: Cents;
      commission: Cents;
    }
  >();

  for (const entry of entries) {
    const current = byEmployee.get(entry.employeeId) ?? {
      employeeId: entry.employeeId,
      fullName: entry.fullName,
      isActive: entry.isActive,
      tickets: new Set<string>(),
      salesAttributed: 0,
      commission: 0,
    };

    current.tickets.add(entry.workOrderId);
    current.commission += entry.amount;

    const salesShares = splitCommission(entry.ticketTotal, entry.washerCount);
    current.salesAttributed += salesShares[entry.washerIndex] ?? 0;

    byEmployee.set(entry.employeeId, current);
  }

  const employees = [...byEmployee.values()]
    .filter((row) => row.commission !== 0 || row.tickets.size !== 0)
    .sort((left, right) => {
      if (left.commission !== right.commission) return right.commission - left.commission;

      return left.fullName.localeCompare(right.fullName, 'es');
    })
    .map((row) => ({
      employeeId: row.employeeId,
      fullName: row.fullName,
      isActive: row.isActive,
      ticketCount: row.tickets.size,
      salesAttributed: toDecimalString(row.salesAttributed),
      commission: toDecimalString(row.commission),
    }));

  const unassignedCommission = unassigned.reduce((sum, row) => sum + row.commissionTotal, 0);
  const totalPayable = employees.reduce(
    (sum, row) => sum + (byEmployee.get(row.employeeId)?.commission ?? 0),
    0,
  );

  return {
    from: range.from,
    to: range.to,
    employees,
    unassigned: {
      ticketCount: unassigned.length,
      commission: toDecimalString(unassignedCommission),
    },
    totalPayable: toDecimalString(totalPayable),
  };
}
