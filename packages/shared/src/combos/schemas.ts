import { z } from 'zod';

import { civilDateSchema, listSearchSchema, moneySchema, pageQueryShape } from '../schemas';
import {
  COMBO_MAX_DISCOUNT_PERCENT,
  COMBO_MAX_PRODUCT_QUANTITY,
  COMBO_MIN_DISCOUNT_PERCENT,
  COMBO_MIN_ITEMS,
  COMBO_NAME_MAX_LENGTH,
  COMBO_PRICING_MODES,
  COMBO_STATUSES,
} from './contracts';
import type { ComboPricingMode } from './contracts';

/**
 * spec 104 — Schemas de `/api/combos`. Mensajes cortos y en español: la UI de
 * combos no lleva texto de ayuda, solo el error de dos o tres palabras.
 *
 * Lo que necesita la base —que cada tipo de carro activo tenga precio, que el
 * precio fijo sea menor que la suma por separado, que servicios y productos
 * existan y estén activos, el nombre único— lo valida el API.
 */

export const comboPricingModeSchema = z.enum(COMBO_PRICING_MODES, {
  message: 'Elegí el precio',
});

export const comboStatusSchema = z.enum(COMBO_STATUSES, { message: 'Estado inválido' });

/** Un servicio del catálogo dentro del combo. Siempre cantidad 1. */
export const serviceComboItemSchema = z.object({
  serviceId: z.uuid({ message: 'Servicio inválido' }),
});
export type ServiceComboItemInput = z.infer<typeof serviceComboItemSchema>;

/** Un producto del inventario dentro del combo, entero de 1 a 10 (RN-1). */
export const productComboItemSchema = z.object({
  inventoryItemId: z.uuid({ message: 'Producto inválido' }),
  quantity: z
    .number({ message: 'Cantidad inválida' })
    .int({ message: 'Cantidad entera' })
    .min(1, { message: 'Mínimo 1' })
    .max(COMBO_MAX_PRODUCT_QUANTITY, { message: `Máximo ${COMBO_MAX_PRODUCT_QUANTITY}` }),
});
export type ProductComboItemInput = z.infer<typeof productComboItemSchema>;

/**
 * Un componente: un servicio **o** un producto. Se distinguen por la clave;
 * usá {@link isServiceComboItem} / {@link isProductComboItem}.
 */
export const comboItemInputSchema = z.union([serviceComboItemSchema, productComboItemSchema]);
export type ComboItemInput = z.infer<typeof comboItemInputSchema>;

export function isServiceComboItem(item: ComboItemInput): item is ServiceComboItemInput {
  return 'serviceId' in item;
}

export function isProductComboItem(item: ComboItemInput): item is ProductComboItemInput {
  return 'inventoryItemId' in item;
}

const comboName = z
  .string()
  .trim()
  .min(1, { message: 'Falta el nombre' })
  .max(COMBO_NAME_MAX_LENGTH, { message: `Máximo ${COMBO_NAME_MAX_LENGTH} letras` });

const comboItems = z
  .array(comboItemInputSchema)
  .min(COMBO_MIN_ITEMS, { message: 'Mínimo dos cosas' });

/** Solo en `PERCENT`. `null` se acepta como «sin descuento» para el formulario. */
const discountPercent = z
  .number({ message: 'Descuento inválido' })
  .int({ message: 'Descuento entero' })
  .min(COMBO_MIN_DISCOUNT_PERCENT, { message: `Mínimo ${COMBO_MIN_DISCOUNT_PERCENT}%` })
  .max(COMBO_MAX_DISCOUNT_PERCENT, { message: `Máximo ${COMBO_MAX_DISCOUNT_PERCENT}%` })
  .nullish();

/**
 * Precio fijo por tipo de carro (solo `FIXED`; en `PERCENT` el API los ignora).
 * Que estén todos los tipos activos y por debajo de la suma lo valida el API.
 */
const comboPrices = z.array(
  z.object({ bodyTypeId: z.uuid({ message: 'Tipo inválido' }), price: moneySchema }),
);

/** `YYYY-MM-DD` que además existe en el calendario (sin 31 de febrero). */
const comboDate = civilDateSchema.refine(isCalendarDate, { message: 'Fecha inválida' });

const weekdays = z
  .array(
    z
      .number({ message: 'Día inválido' })
      .int({ message: 'Día inválido' })
      .min(0, { message: 'Día inválido' })
      .max(6, { message: 'Día inválido' }),
  )
  .min(1, { message: 'Elegí un día' })
  .refine((days) => new Set(days).size === days.length, { message: 'Día repetido' });

/** Lo que las reglas sin base miran; en la edición cualquier campo puede faltar. */
interface ComboRuleInput {
  items?: ComboItemInput[];
  pricingMode?: ComboPricingMode;
  discountPercent?: number | null;
  prices?: { bodyTypeId: string; price: string }[];
  validFrom?: string;
  validTo?: string | null;
}

/**
 * Reglas que se pueden validar sin base (RN-1, RN-2, RN-3): al menos un
 * servicio, sin componentes repetidos, descuento solo en `PERCENT` (y
 * obligatorio ahí), precios > 0 y sin tipo repetido, `validTo ≥ validFrom`.
 */
function checkComboRules(value: ComboRuleInput, ctx: z.RefinementCtx): void {
  if (value.items !== undefined) {
    if (!value.items.some(isServiceComboItem)) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Falta un servicio' });
    }

    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      const key = isServiceComboItem(item) ? `S:${item.serviceId}` : `P:${item.inventoryItemId}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['items', index], message: 'Repetido' });
      }
      seen.add(key);
    });
  }

  const hasDiscount = value.discountPercent !== undefined && value.discountPercent !== null;
  if (value.pricingMode === 'PERCENT' && !hasDiscount) {
    ctx.addIssue({ code: 'custom', path: ['discountPercent'], message: 'Falta el descuento' });
  }
  if (value.pricingMode === 'FIXED' && hasDiscount) {
    ctx.addIssue({ code: 'custom', path: ['discountPercent'], message: 'Solo con descuento' });
  }

  if (value.prices !== undefined) {
    const bodyTypes = new Set<string>();
    value.prices.forEach((row, index) => {
      if (bodyTypes.has(row.bodyTypeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['prices', index, 'bodyTypeId'],
          message: 'Repetido',
        });
      }
      bodyTypes.add(row.bodyTypeId);
      if (/^0+\.00$/.test(row.price)) {
        ctx.addIssue({
          code: 'custom',
          path: ['prices', index, 'price'],
          message: 'Mayor que cero',
        });
      }
    });
  }

  if (
    value.validFrom !== undefined &&
    value.validTo !== undefined &&
    value.validTo !== null &&
    value.validTo < value.validFrom
  ) {
    ctx.addIssue({ code: 'custom', path: ['validTo'], message: 'Antes del inicio' });
  }
}

/** `POST /combos`. */
export const createComboSchema = z
  .object({
    name: comboName,
    items: comboItems,
    pricingMode: comboPricingModeSchema,
    discountPercent,
    prices: comboPrices.default([]),
    validFrom: comboDate,
    /** `null` o ausente = sin fin. */
    validTo: comboDate.nullish(),
    weekdays,
    isActive: z.boolean().default(true),
  })
  .superRefine(checkComboRules);
export type CreateComboInput = z.infer<typeof createComboSchema>;
/** Lo que entra al schema, antes de los `default`: el tipo del formulario. */
export type CreateComboFormValues = z.input<typeof createComboSchema>;

/**
 * `PATCH /combos/:id`. Todo opcional y sin defaults: lo que no viene no se toca,
 * y `items` / `prices` / `weekdays` si vienen reemplazan los de antes. Las
 * reglas que cruzan campos se revisan con lo que vino; el API las vuelve a
 * mirar sobre el combo ya combinado.
 */
export const updateComboSchema = z
  .object({
    name: comboName.optional(),
    items: comboItems.optional(),
    pricingMode: comboPricingModeSchema.optional(),
    discountPercent,
    prices: comboPrices.optional(),
    validFrom: comboDate.optional(),
    validTo: comboDate.nullish(),
    weekdays: weekdays.optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine(checkComboRules);
export type UpdateComboInput = z.infer<typeof updateComboSchema>;

/** `GET /combos`: nombre o código, estado y página. Orden `name`, `id`. */
export const combosQuerySchema = z.object({
  search: listSearchSchema,
  status: comboStatusSchema.optional(),
  ...pageQueryShape,
});
export type CombosQuery = z.infer<typeof combosQuerySchema>;

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
