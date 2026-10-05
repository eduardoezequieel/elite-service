import { z } from 'zod';

import {
  chargePaymentSchema,
  chargeProductInputSchema,
  civilDateSchema,
  MAX_CHARGE_PAYMENTS,
  moneySchema,
  pageQueryShape,
  priceAuthorizationSchema,
  reverseTicketSchema,
} from '../schemas';
import type { ChargeProductInput } from '../schemas';
import { COUNTER_SALE_STATUSES } from './contracts';

/**
 * spec 065 — Schemas de `/api/sales` (venta suelta, RN-18 a RN-22).
 */

/**
 * Una línea pedida. `unitPrice` ausente = el precio del artículo. Es el mismo
 * producto suelto de la cuenta (066): la venta sin lavados es una cuenta más.
 */
export const counterSaleItemInputSchema = chargeProductInputSchema;
export type CounterSaleItemInput = ChargeProductInput;

/**
 * Vender y cobrar en el mismo acto (RN-18, RN-20). `payments` y `cashTendered`
 * son los de la cuenta de la 059. `priceAuthorization` se exige cuando alguna
 * línea trae `unitPrice` menor al precio del artículo (RN-21); esa regla la
 * aplica el API, que conoce los precios.
 */
export const createCounterSaleSchema = z.object({
  customerName: z
    .string()
    .trim()
    .max(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
    .optional(),
  items: z
    .array(counterSaleItemInputSchema)
    .min(1, { message: 'Agregá al menos un producto.' })
    .max(50, { message: 'Una venta admite hasta 50 productos.' })
    .refine((items) => new Set(items.map((item) => item.inventoryItemId)).size === items.length, {
      message: 'Hay un producto repetido en la venta: subile la cantidad.',
    }),
  payments: z
    .array(chargePaymentSchema)
    .min(1, { message: 'Falta el pago.' })
    .max(MAX_CHARGE_PAYMENTS, {
      message: `Un cobro admite hasta ${MAX_CHARGE_PAYMENTS} pagos, uno por método.`,
    }),
  cashTendered: moneySchema.optional(),
  priceAuthorization: priceAuthorizationSchema.optional(),
});
export type CreateCounterSaleInput = z.infer<typeof createCounterSaleSchema>;

/** Anular una venta: lo mismo que deshacer un cobro (045, RN-22). */
export const voidCounterSaleSchema = reverseTicketSchema;
export type VoidCounterSaleInput = z.infer<typeof voidCounterSaleSchema>;

export const counterSaleStatusSchema = z.enum(COUNTER_SALE_STATUSES, {
  message: 'Estado de venta inválido.',
});

/** `GET /sales`. Sin fecha, el API usa hoy en `America/El_Salvador`. */
export const counterSalesQuerySchema = z.object({
  date: civilDateSchema.optional(),
  status: counterSaleStatusSchema.optional(),
  ...pageQueryShape,
});
export type CounterSalesQuery = z.infer<typeof counterSalesQuerySchema>;

/**
 * `GET /sales/feed` (106): los mismos filtros. `status=PAID` trae las ventas
 * cobradas y los abonos; `VOID`, solo las anuladas (un abono no se anula).
 */
export const salesFeedQuerySchema = counterSalesQuerySchema;
export type SalesFeedQuery = CounterSalesQuery;
