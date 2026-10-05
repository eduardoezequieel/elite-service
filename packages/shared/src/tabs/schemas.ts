import { z } from 'zod';

import { chargePaymentSchema, pageQueryShape, quantitySchema } from '../schemas';
import { TAB_HOLDER_KINDS, TAB_MAX_LINES, TAB_STATUSES } from './contracts';

/**
 * spec 106 — Schemas de `/api/tabs` (cuentas abiertas).
 */

export const tabHolderKindSchema = z.enum(TAB_HOLDER_KINDS, {
  message: 'Elegí si es un empleado o un cliente.',
});

/** A quién se le anota: un empleado o un cliente (RN-1). */
export const tabHolderRefSchema = z.object({
  kind: tabHolderKindSchema,
  id: z.uuid({ message: 'Elegí a quién se le anota.' }),
});
export type TabHolderRef = z.infer<typeof tabHolderRefSchema>;

/** Un producto a anotar. Sin precio: es el del artículo al anotar (RN-4). */
export const tabLineInputSchema = z.object({
  inventoryItemId: z.uuid({ message: 'Producto inválido.' }),
  quantity: quantitySchema,
});
export type TabLineInput = z.infer<typeof tabLineInputSchema>;

/**
 * `POST /tabs/lines`: anotar productos a un titular. Si no tiene cuenta
 * abierta, se le abre en la misma transacción (RN-2).
 */
export const addTabLinesSchema = z.object({
  holder: tabHolderRefSchema,
  items: z
    .array(tabLineInputSchema)
    .min(1, { message: 'Agregá al menos un producto.' })
    .max(TAB_MAX_LINES, {
      message: `No pueden ser más de ${TAB_MAX_LINES} productos a la vez.`,
    })
    .refine((items) => new Set(items.map((item) => item.inventoryItemId)).size === items.length, {
      message: 'Hay un producto repetido: subile la cantidad.',
    }),
});
export type AddTabLinesInput = z.infer<typeof addTabLinesSchema>;

/** `POST /tabs/:id/lines/:lineId/void`: quitar una línea, con motivo (RN-5). */
export const voidTabLineSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Escribí por qué se quita.' })
    .max(500, { message: 'El motivo no puede pasar de 500 caracteres.' }),
});
export type VoidTabLineInput = z.infer<typeof voidTabLineSchema>;

/**
 * `POST /tabs/:id/payments`: un abono, un método (RN-7). Mismas reglas de
 * método que cualquier cobro (069); que no pase del saldo lo valida el API.
 */
export const payTabSchema = chargePaymentSchema.refine(
  (payment) => !/^0+\.00$/.test(payment.amount),
  { path: ['amount'], message: 'El abono tiene que ser mayor que cero.' },
);
export type PayTabInput = z.infer<typeof payTabSchema>;

/**
 * `GET /tabs`. Sin `status`, las abiertas. `search` busca en el nombre del
 * titular y en el número (`C-0012`, `12`).
 */
export const tabsQuerySchema = z.object({
  status: z.enum(TAB_STATUSES, { message: 'Estado de cuenta inválido.' }).default('OPEN'),
  holder: tabHolderKindSchema.optional(),
  search: z
    .string()
    .trim()
    .max(120, { message: 'La búsqueda no puede pasar de 120 caracteres.' })
    .optional(),
  ...pageQueryShape,
});
export type TabsQuery = z.infer<typeof tabsQuerySchema>;

/** `GET /tabs/holders`. Busca en el nombre y, en un cliente, en el teléfono y la placa. */
export const tabHoldersQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(120, { message: 'La búsqueda no puede pasar de 120 caracteres.' })
    .optional(),
});
export type TabHoldersQuery = z.infer<typeof tabHoldersQuerySchema>;
