import {
  DEFAULT_MAINTENANCE_SHOP,
  createFleetExpenseSchema,
  createMaintenanceLogSchema,
  updateFleetExpenseSchema,
} from '@elite/shared';
import type { FleetExpenseRow, FleetExpenseType, MaintenancePlanTask } from '@elite/shared';
import { z } from 'zod';

import { formatCivil, todayCivil } from '@/lib/civil-date';
import {
  TYPED_DATE_MESSAGE,
  civilOrNull,
  moneyOrNull,
  numberToField,
  textOrNull,
  wholeOrNull,
} from '../rentals/form-draft';

/**
 * Los formularios de mantenimiento y gastos (099): lo que se escribe y cómo se
 * vuelve el cuerpo del pedido. La regla es la del schema de `@elite/shared`,
 * que valida después del puente.
 */

// ===================== Servicio =====================

export interface MaintenanceLogFormValues {
  vehicleId: string;
  taskIds: string[];
  performedAt: string;
  odometerKm: string;
  cost: string;
  shop: string;
  notes: string;
}

/** Hoy, el taller de la familia, y las tareas marcadas de entrada si las hay. */
export function emptyMaintenanceLogForm(
  vehicleId = '',
  taskIds: string[] = [],
  today = todayCivil(),
): MaintenanceLogFormValues {
  return {
    vehicleId,
    taskIds,
    performedAt: formatCivil(today),
    odometerKm: '',
    cost: '',
    shop: DEFAULT_MAINTENANCE_SHOP,
    notes: '',
  };
}

export function maintenanceLogDraft(values: MaintenanceLogFormValues): Record<string, unknown> {
  return {
    vehicleId: values.vehicleId,
    taskIds: values.taskIds,
    performedAt: civilOrNull(values.performedAt),
    odometerKm: wholeOrNull(values.odometerKm),
    cost: moneyOrNull(values.cost),
    shop: textOrNull(values.shop),
    notes: textOrNull(values.notes),
  };
}

/** La fecha del servicio es obligatoria: vacía o mal escrita, el mismo aviso. */
export const maintenanceLogFormSchema = z
  .custom<MaintenanceLogFormValues>()
  .superRefine((values, ctx) => {
    if (civilOrNull(values.performedAt) === null) {
      ctx.addIssue({ code: 'custom', path: ['performedAt'], message: TYPED_DATE_MESSAGE });
    }
    if (values.vehicleId === '') {
      ctx.addIssue({ code: 'custom', path: ['vehicleId'], message: 'Elegí el carro.' });
    }
  })
  .transform(maintenanceLogDraft)
  .pipe(createMaintenanceLogSchema);

/** Las tareas que se pueden marcar en un servicio: las activas, en el orden del plan. */
export function selectableTasks(plan: readonly MaintenancePlanTask[]): MaintenancePlanTask[] {
  return plan.filter((task) => task.isActive);
}

// ===================== Gasto =====================

export interface FleetExpenseFormValues {
  vehicleId: string;
  type: FleetExpenseType;
  amount: string;
  incurredAt: string;
  odometerKm: string;
  description: string;
}

export function emptyFleetExpenseForm(
  vehicleId = '',
  today = todayCivil(),
): FleetExpenseFormValues {
  return {
    vehicleId,
    type: 'OTHER',
    amount: '',
    incurredAt: formatCivil(today),
    odometerKm: '',
    description: '',
  };
}

export function fleetExpenseFormValuesOf(row: FleetExpenseRow): FleetExpenseFormValues {
  return {
    vehicleId: row.vehicle.id,
    type: row.type,
    amount: row.amount,
    incurredAt: formatCivil(row.incurredAt),
    odometerKm: numberToField(row.odometerKm),
    description: row.description ?? '',
  };
}

export function fleetExpenseDraft(values: FleetExpenseFormValues): Record<string, unknown> {
  return {
    vehicleId: values.vehicleId,
    type: values.type,
    amount: values.amount.trim().replace(',', '.'),
    incurredAt: civilOrNull(values.incurredAt),
    odometerKm: wholeOrNull(values.odometerKm),
    description: textOrNull(values.description),
  };
}

const expenseFormShape = z.custom<FleetExpenseFormValues>().superRefine((values, ctx) => {
  if (civilOrNull(values.incurredAt) === null) {
    ctx.addIssue({ code: 'custom', path: ['incurredAt'], message: TYPED_DATE_MESSAGE });
  }
  if (values.vehicleId === '') {
    ctx.addIssue({ code: 'custom', path: ['vehicleId'], message: 'Elegí el carro.' });
  }
});

export const createFleetExpenseFormSchema = expenseFormShape
  .transform(fleetExpenseDraft)
  .pipe(createFleetExpenseSchema);

export const updateFleetExpenseFormSchema = expenseFormShape
  .transform(fleetExpenseDraft)
  .pipe(updateFleetExpenseSchema);
