import type { CommissionEmployeeDetail, CommissionReport } from '@elite/shared';

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

/** Lo minimo de una linea para saber si paga comision. */
export interface CommissionLine {
  kind: 'SERVICE' | 'PRODUCT';
  /** `unitPrice × quantity`, en centavos. */
  total: Cents;
}

/**
 * La base de la comision de un lavado: solo sus servicios (065 RN-8). Un
 * producto se cobra en la misma cuenta pero no paga comision a nadie; entra al
 * total del ticket y no a esta suma.
 */
export function commissionBaseOf(lines: readonly CommissionLine[]): Cents {
  return lines.reduce((sum, line) => (line.kind === 'SERVICE' ? sum + line.total : sum), 0);
}

/**
 * Parte `total` entre `n` empleados en centavos: los primeros `n − 1` reciben
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
export function resolveCommissionRange(
  from?: string,
  to?: string,
  today = civilDateInBusinessZone(),
): { from: string; to: string } {
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

/** La misma entrada con lo que el detalle de un empleado muestra del lavado (061). */
export interface CommissionWashRecord extends CommissionEntryRecord {
  ticketNumber: string;
  chargedAt: Date;
  plate: string;
}

/** Ticket PAID sin empleado: la comisión se calculó y no se asignó. */
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

/**
 * El detalle de un empleado: una línea por lavado cobrado, más reciente arriba,
 * y los mismos totales que su fila del reporte (061). Tampoco recalcula: la
 * comisión es la entrada congelada y las ventas, su parte del total (009 RN-4).
 */
export function buildEmployeeCommissionDetail(
  range: { from: string; to: string },
  employee: { id: string; fullName: string; isActive: boolean },
  washes: readonly CommissionWashRecord[],
): CommissionEmployeeDetail {
  const lines = [...washes]
    .sort((left, right) => right.chargedAt.getTime() - left.chargedAt.getTime())
    .map((wash) => ({
      wash,
      salesAttributed: splitCommission(wash.ticketTotal, wash.washerCount)[wash.washerIndex] ?? 0,
    }));

  const salesAttributed = lines.reduce((sum, line) => sum + line.salesAttributed, 0);
  const commission = lines.reduce((sum, line) => sum + line.wash.amount, 0);

  return {
    from: range.from,
    to: range.to,
    employee,
    ticketCount: new Set(lines.map((line) => line.wash.workOrderId)).size,
    salesAttributed: toDecimalString(salesAttributed),
    commission: toDecimalString(commission),
    washes: lines.map(({ wash, salesAttributed: share }) => ({
      workOrderId: wash.workOrderId,
      ticketNumber: wash.ticketNumber,
      chargedAt: wash.chargedAt.toISOString(),
      plate: wash.plate,
      ticketTotal: toDecimalString(wash.ticketTotal),
      washerCount: wash.washerCount,
      salesAttributed: toDecimalString(share),
      commission: toDecimalString(wash.amount),
    })),
  };
}
