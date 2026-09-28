/**
 * Consumo de empleados: lo que un trabajador toma sin que se le cobre (070).
 *
 * El valor es a precio de venta congelado al anotar (RN-4) y un consumo anulado
 * no cuenta en su mes, se haya anulado cuando se haya anulado (RN-5). Todo en
 * enteros: cantidades en milésimas y dinero en centavos.
 */
import type { Cents } from './cost';
import type { Milli } from './stock';

/** Ese consumo ya tiene su `CONSUMPTION_RETURN`: se anula una sola vez (RN-6). */
export class ConsumptionAlreadyReversedError extends Error {
  constructor(readonly movementId: string) {
    super('Consumption already reversed');
    this.name = 'ConsumptionAlreadyReversedError';
  }
}

/**
 * `unitPrice × quantity`, redondeado al centavo (mitad hacia arriba). En
 * `bigint`: milésimas por centavos pueden pasar el entero seguro.
 */
export function consumptionValue(quantity: Milli, unitPrice: Cents): Cents {
  const product = BigInt(Math.abs(quantity)) * BigInt(unitPrice);

  return Number((product * 2n + 1000n) / 2000n);
}

/** Lo mínimo de un consumo para sumarlo. `quantity` positiva. */
export interface ConsumptionFigures {
  employeeId: string;
  /** Para desempatar el orden: el dominio no conoce más del empleado. */
  employeeName: string;
  quantity: Milli;
  unitPrice: Cents;
  reversed: boolean;
}

export interface ConsumptionTotals {
  units: Milli;
  total: Cents;
}

export interface EmployeeConsumptionTotals extends ConsumptionTotals {
  employeeId: string;
}

/**
 * Unidades y valor de lo que no se anuló. Cada consumo se redondea solo, así la
 * suma cuadra con el detalle.
 */
export function consumptionTotals(entries: readonly ConsumptionFigures[]): ConsumptionTotals {
  return entries
    .filter((entry) => !entry.reversed)
    .reduce<ConsumptionTotals>(
      (sum, entry) => ({
        units: sum.units + entry.quantity,
        total: sum.total + consumptionValue(entry.quantity, entry.unitPrice),
      }),
      { units: 0, total: 0 },
    );
}

/**
 * El reporte del mes por trabajador: sin los anulados, sin quien no consumió
 * nada, de mayor a menor valor (y a igual valor, más unidades y después por
 * nombre).
 */
export function consumptionByEmployee(entries: readonly ConsumptionFigures[]): {
  rows: EmployeeConsumptionTotals[];
  total: Cents;
} {
  const byEmployee = new Map<string, { name: string; entries: ConsumptionFigures[] }>();

  for (const entry of entries) {
    if (entry.reversed) continue;
    const group = byEmployee.get(entry.employeeId) ?? { name: entry.employeeName, entries: [] };

    group.entries.push(entry);
    byEmployee.set(entry.employeeId, group);
  }

  const rows = [...byEmployee.entries()]
    .map(([employeeId, group]) => ({
      employeeId,
      name: group.name,
      ...consumptionTotals(group.entries),
    }))
    .sort((a, b) => b.total - a.total || b.units - a.units || a.name.localeCompare(b.name, 'es'))
    .map(({ employeeId, units, total }) => ({ employeeId, units, total }));

  return { rows, total: rows.reduce((sum, row) => sum + row.total, 0) };
}
