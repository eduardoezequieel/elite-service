import { z } from 'zod';

import {
  civilDateSchema,
  moneySchema,
  pageQueryShape,
  quantitySchema,
  queryFlagSchema,
  signedQuantitySchema,
} from '../schemas';
import { INVENTORY_ITEM_KINDS, INVENTORY_MOVEMENT_TYPES } from './contracts';

/**
 * spec 065 — Schemas de `/api/inventory`. Los mensajes van en español porque los
 * ve el usuario.
 */

const categoryName = z
  .string()
  .trim()
  .min(1, { message: 'Escribí el nombre de la categoría.' })
  .max(80, { message: 'El nombre no puede pasar de 80 caracteres.' });

const itemName = z
  .string()
  .trim()
  .min(1, { message: 'Escribí el nombre del artículo.' })
  .max(120, { message: 'El nombre no puede pasar de 120 caracteres.' });

const unit = z
  .string()
  .trim()
  .min(1, { message: 'Escribí la unidad.' })
  .max(30, { message: 'La unidad no puede pasar de 30 caracteres.' });

/** Texto; el escáner es de teclado, no hay cámara (fuera de alcance). */
const barcode = z
  .string()
  .trim()
  .min(1, { message: 'Escribí el código de barras.' })
  .max(64, { message: 'El código de barras no puede pasar de 64 caracteres.' });

/** Mínimo: cero o más, tres decimales. Cero = sin alerta (RN-13). */
const minStock = z
  .union([z.string().trim(), z.number()])
  .transform((value) => (typeof value === 'number' ? value.toFixed(3) : value))
  .refine((value) => /^\d+(\.\d{1,3})?$/.test(value), {
    message: 'Escribí un mínimo válido, con hasta tres decimales.',
  })
  .transform((value) => {
    const [whole, fraction = ''] = value.split('.');
    return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(3, '0')}`;
  });

const isZeroMoney = (value: string) => /^0+\.00$/.test(value);

// --- categorías ---

export const inventoryCategoriesQuerySchema = z.object({
  /** Solo las de ese tipo (072). Sin él, todas. */
  kind: z.enum(INVENTORY_ITEM_KINDS, { message: 'Elegí producto o insumo.' }).optional(),
  includeInactive: queryFlagSchema.optional(),
});
export type InventoryCategoriesQuery = z.infer<typeof inventoryCategoriesQuerySchema>;

/** El tipo se fija al crear y `update` no lo acepta (072). */
export const createInventoryCategorySchema = z.object({
  kind: z.enum(INVENTORY_ITEM_KINDS, { message: 'Elegí producto o insumo.' }),
  name: categoryName,
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateInventoryCategoryInput = z.infer<typeof createInventoryCategorySchema>;

export const updateInventoryCategorySchema = z.object({
  name: categoryName.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateInventoryCategoryInput = z.infer<typeof updateInventoryCategorySchema>;

// --- artículos ---

export const inventoryItemKindSchema = z.enum(INVENTORY_ITEM_KINDS, {
  message: 'Elegí producto o insumo.',
});

export const inventoryItemsQuerySchema = z.object({
  kind: inventoryItemKindSchema.optional(),
  /** Nombre, código o código de barras. */
  search: z.string().trim().max(120).optional(),
  categoryId: z.uuid({ message: 'Categoría inválida.' }).optional(),
  /** Solo los que están en o bajo el mínimo. */
  lowStock: queryFlagSchema.optional(),
  includeInactive: queryFlagSchema.optional(),
  ...pageQueryShape,
});
export type InventoryItemsQuery = z.infer<typeof inventoryItemsQuerySchema>;

/**
 * Alta de un artículo. Un `PRODUCT` exige precio mayor que cero (RN-1). Un
 * `SUPPLY` con precio no se corta acá sino en el API, que responde
 * `400 SUPPLY_HAS_PRICE`: el formulario de insumo ni muestra el campo.
 */
export const createInventoryItemSchema = z
  .object({
    kind: inventoryItemKindSchema,
    name: itemName,
    categoryId: z.uuid({ message: 'Categoría inválida.' }).optional(),
    unit: unit.optional(),
    price: moneySchema.optional(),
    minStock: minStock.optional(),
    barcode: barcode.optional(),
  })
  .refine(
    (value) => value.kind !== 'PRODUCT' || (value.price !== undefined && !isZeroMoney(value.price)),
    { message: 'Un producto necesita un precio mayor que cero.', path: ['price'] },
  );
export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

/**
 * Edición de un artículo. `kind` no está: se fija al crear (RN-1) y, si llega,
 * se descarta. `categoryId` y `barcode` en `null` los quitan.
 */
export const updateInventoryItemSchema = z.object({
  name: itemName.optional(),
  categoryId: z.uuid({ message: 'Categoría inválida.' }).nullable().optional(),
  unit: unit.optional(),
  price: moneySchema.optional(),
  minStock: minStock.optional(),
  barcode: barcode.nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

// --- movimientos ---

/** `GET /items/:id/movements`: el kardex de un artículo, más nuevo primero. */
export const inventoryItemMovementsQuerySchema = z.object(pageQueryShape);
export type InventoryItemMovementsQuery = z.infer<typeof inventoryItemMovementsQuerySchema>;

/** Entrada (RN-11). Si trae costo, recalcula el costo promedio. */
export const createInventoryEntrySchema = z.object({
  quantity: quantitySchema,
  unitCost: moneySchema.optional(),
  reference: z
    .string()
    .trim()
    .max(120, { message: 'La referencia no puede pasar de 120 caracteres.' })
    .optional(),
});
export type CreateInventoryEntryInput = z.infer<typeof createInventoryEntrySchema>;

/**
 * Despacho a un empleado activo (RN-10). La nota se guarda en `reason` del
 * movimiento.
 */
export const createInventoryDispatchSchema = z.object({
  quantity: quantitySchema,
  employeeId: z.uuid({ message: 'Elegí el empleado que recibe.' }),
  note: z
    .string()
    .trim()
    .max(500, { message: 'La nota no puede pasar de 500 caracteres.' })
    .optional(),
});
export type CreateInventoryDispatchInput = z.infer<typeof createInventoryDispatchSchema>;

/** Ajuste tras un conteo físico: cantidad con signo, distinta de cero, y motivo (RN-12). */
export const createInventoryAdjustmentSchema = z.object({
  quantity: signedQuantitySchema,
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Escribí el motivo del ajuste.' })
    .max(500, { message: 'El motivo no puede pasar de 500 caracteres.' }),
});
export type CreateInventoryAdjustmentInput = z.infer<typeof createInventoryAdjustmentSchema>;

export const inventoryMovementTypeSchema = z.enum(INVENTORY_MOVEMENT_TYPES, {
  message: 'Tipo de movimiento inválido.',
});

/** `GET /movements`: el reporte plano. Fechas civiles en `America/El_Salvador`, inclusive. */
export const inventoryMovementsQuerySchema = z.object({
  type: inventoryMovementTypeSchema.optional(),
  itemId: z.uuid({ message: 'Artículo inválido.' }).optional(),
  employeeId: z.uuid({ message: 'Empleado inválido.' }).optional(),
  from: civilDateSchema.optional(),
  to: civilDateSchema.optional(),
  ...pageQueryShape,
});
export type InventoryMovementsQuery = z.infer<typeof inventoryMovementsQuerySchema>;

// --- spec 070: consumo de empleados ---

/** Anotar que un trabajador tomó un producto (RN-3). La nota va en `reason`. */
export const createInventoryConsumptionSchema = z.object({
  quantity: quantitySchema,
  employeeId: z.uuid({ message: 'Elegí el empleado que lo tomó.' }),
  note: z
    .string()
    .trim()
    .max(500, { message: 'La nota no puede pasar de 500 caracteres.' })
    .optional(),
});
export type CreateInventoryConsumptionInput = z.infer<typeof createInventoryConsumptionSchema>;

/** Anular un consumo mal anotado: motivo obligatorio (RN-6). */
export const reverseInventoryConsumptionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Escribí el motivo de la anulación.' })
    .max(500, { message: 'El motivo no puede pasar de 500 caracteres.' }),
});
export type ReverseInventoryConsumptionInput = z.infer<typeof reverseInventoryConsumptionSchema>;

/** Mes civil `YYYY-MM`. Sin mes, el API usa el actual de El Salvador (RN-5). */
export const consumptionMonthQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'El mes tiene que ser YYYY-MM.' })
    .optional(),
});
export type ConsumptionMonthQuery = z.infer<typeof consumptionMonthQuerySchema>;
