import { createMaintenanceLogSchema } from '@elite/shared';
import type { CreateMaintenanceLogInput } from '@elite/shared';
import { z } from 'zod';

import { moneyOrNull } from '../rentals/form-draft';

/**
 * Lo que se escribe en «Anotar lo que se hizo». Los nombres que coinciden con
 * el contrato reciben el error del schema en su campo. `what` es la tarea.
 */
export interface ServiceEntryValues {
  what: string;
  odometerKm: string;
  performedAt: string;
  cost: string;
  notes: string;
}

const FIELD_OF: Record<string, keyof ServiceEntryValues> = {
  taskIds: 'what',
  odometerKm: 'odometerKm',
  performedAt: 'performedAt',
  cost: 'cost',
  notes: 'notes',
};

type MaintenanceLogBody = z.input<typeof createMaintenanceLogSchema>;

/** El cuerpo que valida `createMaintenanceLogSchema`. El km ilegible viaja como `null`. */
export function serviceEntryDraft(
  values: ServiceEntryValues,
  vehicleId: string,
): MaintenanceLogBody {
  const kmText = values.odometerKm.trim();

  return {
    vehicleId,
    taskIds: values.what === '' ? [] : [values.what],
    performedAt: values.performedAt.trim() === '' ? 'invalid' : values.performedAt,
    odometerKm: /^\d+$/.test(kmText) ? Number(kmText) : null,
    cost: values.cost.trim() === '' ? null : moneyOrNull(values.cost),
    notes: values.notes,
  };
}

function put(errors: Partial<Record<string, string>>, field: string, message: string) {
  if (errors[field] === undefined) errors[field] = message;
}

/**
 * El formulario del diálogo: las reglas del contrato, con el km y la fecha
 * obligatorios (110) y el error en el campo que corresponde.
 */
export function serviceEntryFormSchema(vehicleId: string) {
  return z
    .custom<ServiceEntryValues>()
    .superRefine((values, ctx) => {
      const errors: Partial<Record<string, string>> = {};
      const kmText = values.odometerKm.trim();

      if (kmText === '') put(errors, 'odometerKm', 'Escribí el kilometraje.');
      else if (!/^\d+$/.test(kmText)) put(errors, 'odometerKm', 'Tiene que ser un número entero.');
      if (values.performedAt.trim() === '') put(errors, 'performedAt', 'Elegí la fecha.');

      const parsed = createMaintenanceLogSchema.safeParse(serviceEntryDraft(values, vehicleId));
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = FIELD_OF[String(issue.path[0])];
          if (field === undefined) put(errors, 'root', issue.message);
          else put(errors, field, issue.message);
        }
      }

      for (const [field, message] of Object.entries(errors)) {
        if (message !== undefined) {
          ctx.addIssue({ code: 'custom', path: field === 'root' ? [] : [field], message });
        }
      }
    })
    .transform((values) => serviceEntryDraft(values, vehicleId))
    .pipe(createMaintenanceLogSchema);
}

export type ServiceEntryInput = CreateMaintenanceLogInput;
