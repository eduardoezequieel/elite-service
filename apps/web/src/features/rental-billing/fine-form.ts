import { createFineSchema } from '@elite/shared';
import type { CreateFineInput } from '@elite/shared';
import { z } from 'zod';

import { salvadorInstant } from './billing-format';

/**
 * El formulario de la multa (098): lo mismo que `createFineSchema`, pero la
 * fecha llega como `datetime-local` en hora de El Salvador. Los errores del
 * schema del contrato bajan a su campo.
 */
export interface FineFormValues {
  vehicleId: string;
  occurredLocal: string;
  amount: string;
  description: string;
  chargeToCustomer: boolean;
}

export const fineFormSchema = z
  .object({
    vehicleId: z.string(),
    occurredLocal: z.string(),
    amount: z.string(),
    description: z.string(),
    chargeToCustomer: z.boolean(),
  })
  .transform((values, ctx): CreateFineInput => {
    const occurredAt = salvadorInstant(values.occurredLocal);

    if (occurredAt === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['occurredLocal'],
        message: 'Escribí la fecha y la hora de la multa.',
      });
    }

    const parsed = createFineSchema.safeParse({
      vehicleId: values.vehicleId,
      occurredAt: occurredAt ?? new Date(0).toISOString(),
      amount: values.amount,
      description: values.description,
      chargeToCustomer: values.chargeToCustomer,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === 'occurredAt' ? 'occurredLocal' : issue.path[0];
        ctx.addIssue({
          code: 'custom',
          path: [typeof field === 'string' ? field : 'vehicleId'],
          message: issue.message,
        });
      }
      return z.NEVER;
    }

    return occurredAt === null ? z.NEVER : parsed.data;
  });
