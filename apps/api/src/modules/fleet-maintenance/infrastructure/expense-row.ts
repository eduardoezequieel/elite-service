import type { FleetExpenseRow, FleetVehicleRef, MaintenanceLog } from '@elite/shared';
import type { FleetExpense, FleetVehicle, MaintenanceLog as LogRow, Prisma } from '@prisma/client';

import { dateToCivil } from '../../../common/prisma/date-column';
import { isEditableExpense } from '../domain/expenses';

/**
 * Cómo se leen de la base un gasto anotado y un servicio (099). Lo comparten
 * los repositorios de gastos y de servicios, para que un gasto ligado salga
 * igual venga de donde venga.
 */

/** Lo que se pide de un carro para nombrarlo en una fila. */
export const VEHICLE_REF_SELECT = {
  id: true,
  plate: true,
  make: true,
  model: true,
  year: true,
} satisfies Prisma.FleetVehicleSelect;

export function toVehicleRef(
  vehicle: Pick<FleetVehicle, 'id' | 'plate' | 'make' | 'model' | 'year'>,
): FleetVehicleRef {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
  };
}

/** El día de una columna `@db.Date` que no admite nulos. */
export function civilOf(date: Date): string {
  return dateToCivil(date) ?? '';
}

export function toManualExpense(
  row: FleetExpense & { vehicle: Pick<FleetVehicle, 'id' | 'plate' | 'make' | 'model' | 'year'> },
): FleetExpenseRow {
  const source = 'MANUAL' as const;

  return {
    id: row.id,
    source,
    vehicle: toVehicleRef(row.vehicle),
    type: row.type,
    amount: row.amount.toFixed(2),
    incurredAt: civilOf(row.incurredAt),
    odometerKm: row.odometerKm,
    description: row.description,
    maintenanceLogId: row.maintenanceLogId,
    reference: null,
    editable: isEditableExpense({ source, maintenanceLogId: row.maintenanceLogId }),
  };
}

export function toMaintenanceLog(
  row: LogRow & { task: { name: string } | null; expense: { id: string } | null },
): MaintenanceLog {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    taskId: row.taskId,
    taskName: row.task?.name ?? null,
    performedAt: civilOf(row.performedAt),
    odometerKm: row.odometerKm,
    cost: row.cost === null ? null : row.cost.toFixed(2),
    shop: row.shop,
    notes: row.notes,
    expenseId: row.expense?.id ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Lo que se incluye de un servicio para armar su DTO. */
export const LOG_INCLUDE = {
  task: { select: { name: true } },
  expense: { select: { id: true } },
} satisfies Prisma.MaintenanceLogInclude;
