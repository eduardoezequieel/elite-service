import {
  COMBO_MAX_PRODUCT_QUANTITY,
  COMBO_WEEKDAYS,
  createComboSchema,
  type ComboDetail,
  type ComboPricingMode,
  type CreateComboFormValues,
  type CreateComboInput,
  type ServiceDetail,
} from '@elite/shared';
import { z } from 'zod';

import { toCents } from '@/lib/money';
import { catalogPriceOf } from '@/features/carwash/service-groups';

/**
 * El editor de combos (104) sin React: qué campos tiene, cuánto suma por
 * separado cada tipo de carro, cuánto cuesta el combo y qué cuerpo viaja al
 * API. El diálogo solo lo conecta.
 *
 * Las reglas son las de `createComboSchema` de `@elite/shared`: el schema del
 * formulario arma el cuerpo y lo pasa por ahí, y lo que diga se pinta en el
 * campo que corresponde. Lo único que se mira acá además es que el precio fijo
 * quede por debajo de la suma por separado (RN-2), que en el API pide la base.
 */

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------

/** Un componente elegido en el editor. */
export type ComboPick =
  | { kind: 'SERVICE'; id: string; name: string }
  | { kind: 'PRODUCT'; id: string; name: string; quantity: number };

/** `true` si ese servicio o producto ya está en el combo (RN-1: una sola vez). */
export function hasPick(picks: readonly ComboPick[], kind: ComboPick['kind'], id: string): boolean {
  return picks.some((pick) => pick.kind === kind && pick.id === id);
}

/** Agrega al final; si ya estaba, no hace nada. Un producto entra con cantidad 1. */
export function addPick(
  picks: readonly ComboPick[],
  added: { kind: ComboPick['kind']; id: string; name: string },
): ComboPick[] {
  if (hasPick(picks, added.kind, added.id)) return [...picks];

  return [
    ...picks,
    added.kind === 'SERVICE'
      ? { kind: 'SERVICE', id: added.id, name: added.name }
      : { kind: 'PRODUCT', id: added.id, name: added.name, quantity: 1 },
  ];
}

export function removePick(picks: readonly ComboPick[], index: number): ComboPick[] {
  return picks.filter((_, position) => position !== index);
}

/** Sube o baja la cantidad de un producto, entre 1 y 10 (RN-1). */
export function stepPickQuantity(
  picks: readonly ComboPick[],
  index: number,
  delta: number,
): ComboPick[] {
  return picks.map((pick, position) =>
    position === index && pick.kind === 'PRODUCT'
      ? {
          ...pick,
          quantity: Math.min(COMBO_MAX_PRODUCT_QUANTITY, Math.max(1, pick.quantity + delta)),
        }
      : pick,
  );
}

// ---------------------------------------------------------------------------
// Precio
// ---------------------------------------------------------------------------

/** Precio de cada producto por id, del catálogo de productos a la venta. */
export type ProductPrices = Readonly<Record<string, string>>;

/**
 * La suma por separado para un tipo de carro, en centavos: servicio a su
 * precio de matriz (o base) y producto a su precio × cantidad (RN-2). `null`
 * si algún componente no tiene precio a la vista (inactivo o sin cargar).
 */
export function listSumCents(
  picks: readonly ComboPick[],
  bodyTypeId: string,
  services: readonly ServiceDetail[],
  productPrices: ProductPrices,
): number | null {
  let sum = 0;

  for (const pick of picks) {
    if (pick.kind === 'SERVICE') {
      const service = services.find((candidate) => candidate.id === pick.id);
      const cents = service === undefined ? null : toCents(catalogPriceOf(service, bodyTypeId));
      if (cents === null) return null;
      sum += cents;
    } else {
      const price = productPrices[pick.id];
      const cents = price === undefined ? null : toCents(price);
      if (cents === null) return null;
      sum += cents * pick.quantity;
    }
  }

  return sum;
}

/** La suma por separado de cada tipo de carro. */
export function listSums(
  picks: readonly ComboPick[],
  bodyTypeIds: readonly string[],
  services: readonly ServiceDetail[],
  productPrices: ProductPrices,
): Record<string, number | null> {
  return Object.fromEntries(
    bodyTypeIds.map((id) => [id, listSumCents(picks, id, services, productPrices)]),
  );
}

/** `true` si todos los tipos suman lo mismo: entonces el precio es uno solo. */
export function sameSums(sums: Readonly<Record<string, number | null>>): boolean {
  const values = Object.values(sums);

  return values.length > 0 && values.every((value) => value !== null && value === values[0]);
}

/**
 * El precio con descuento, en centavos: suma × (1 − %/100), redondeado al
 * centavo con la mitad hacia arriba (criterio 2).
 */
export function percentPriceCents(sumCents: number, percent: number): number {
  return Math.round((sumCents * (100 - percent)) / 100);
}

/** El descuento tecleado como entero, `null` si está vacío y `NaN` si no es un entero. */
export function parsePercent(raw: string): number | null {
  const clean = raw.trim();
  if (clean === '') return null;

  return /^\d+$/.test(clean) ? Number(clean) : Number.NaN;
}

/** Lo que se deja teclear en el campo de descuento: dos dígitos. */
export function maskPercent(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 2);
}

// ---------------------------------------------------------------------------
// El formulario
// ---------------------------------------------------------------------------

export interface ComboFormValues {
  name: string;
  items: ComboPick[];
  pricingMode: ComboPricingMode;
  /** El descuento como se teclea. Solo cuenta en `PERCENT`. */
  discountPercent: string;
  /** El precio fijo por tipo de carro, como se teclea. Solo cuenta en `FIXED`. */
  prices: Record<string, string>;
  validFrom: string;
  /** `''` con «Sin fin». */
  validTo: string;
  noEnd: boolean;
  weekdays: number[];
  isActive: boolean;
}

export const ALL_WEEKDAYS: number[] = [...COMBO_WEEKDAYS];

/** Un combo nuevo: precio fijo, desde hoy, sin fin, todos los días, activo. */
export function emptyComboForm(today: string): ComboFormValues {
  return {
    name: '',
    items: [],
    pricingMode: 'FIXED',
    discountPercent: '10',
    prices: {},
    validFrom: today,
    validTo: '',
    noEnd: true,
    weekdays: [...ALL_WEEKDAYS],
    isActive: true,
  };
}

/** Sufijo del duplicado. */
export const COPY_SUFFIX = ' (copia)';

/**
 * El formulario tal como está el combo. Duplicar le suma «(copia)» al nombre
 * y lo deja pausado, para revisarlo antes de que salga en el alta.
 */
export function comboFormOf(combo: ComboDetail, mode: 'edit' | 'duplicate'): ComboFormValues {
  return {
    name: mode === 'duplicate' ? `${combo.name}${COPY_SUFFIX}` : combo.name,
    items: combo.items.flatMap((item): ComboPick[] => {
      if (item.kind === 'SERVICE' && item.serviceId !== null) {
        return [{ kind: 'SERVICE', id: item.serviceId, name: item.name }];
      }
      if (item.kind === 'PRODUCT' && item.inventoryItemId !== null) {
        return [
          { kind: 'PRODUCT', id: item.inventoryItemId, name: item.name, quantity: item.quantity },
        ];
      }

      return [];
    }),
    pricingMode: combo.pricingMode,
    discountPercent: combo.discountPercent === null ? '10' : String(combo.discountPercent),
    prices:
      combo.pricingMode === 'FIXED'
        ? Object.fromEntries(combo.prices.map((row) => [row.bodyTypeId, row.price]))
        : {},
    validFrom: combo.validFrom,
    validTo: combo.validTo ?? '',
    noEnd: combo.validTo === null,
    weekdays: [...combo.weekdays],
    isActive: mode === 'duplicate' ? false : combo.isActive,
  };
}

/**
 * El cuerpo que viaja, sin validar todavía: lo que el usuario dejó en el
 * formulario, con la forma de `createComboSchema`. En `PERCENT` no van
 * precios; en `FIXED`, uno por cada tipo de carro activo.
 */
export function comboPayloadOf(
  values: ComboFormValues,
  bodyTypeIds: readonly string[],
): CreateComboFormValues {
  const fixed = values.pricingMode === 'FIXED';

  return {
    name: values.name,
    items: values.items.map((pick) =>
      pick.kind === 'SERVICE'
        ? { serviceId: pick.id }
        : { inventoryItemId: pick.id, quantity: pick.quantity },
    ),
    pricingMode: values.pricingMode,
    discountPercent: fixed ? null : parsePercent(values.discountPercent),
    prices: fixed
      ? bodyTypeIds.map((bodyTypeId) => ({
          bodyTypeId,
          price: (values.prices[bodyTypeId] ?? '').trim().replace(',', '.'),
        }))
      : [],
    validFrom: values.validFrom,
    validTo: values.noEnd || values.validTo === '' ? null : values.validTo,
    weekdays: [...values.weekdays].sort((a, b) => a - b),
    isActive: values.isActive,
  };
}

/** El error corto de un precio fijo, o `null` si está bien. */
export function fixedPriceIssue(raw: string | undefined, sumCents: number | null): string | null {
  const text = (raw ?? '').trim().replace(',', '.');
  if (text === '') return 'Falta el precio';

  const cents = toCents(text);
  if (cents === null || cents < 0) return 'Monto inválido';
  if (cents === 0) return 'Mayor que cero';
  if (sumCents !== null && cents >= sumCents) return 'Sin ahorro';

  return null;
}

/** Dónde se pinta un error del schema compartido; `null` si lo cubre otra regla. */
export function formPathOf(path: readonly PropertyKey[]): keyof ComboFormValues | null {
  const head = path[0];

  switch (head) {
    case 'name':
    case 'items':
    case 'pricingMode':
    case 'discountPercent':
    case 'validFrom':
    case 'validTo':
    case 'weekdays':
      return head;
    default:
      // `prices` lo revisa `fixedPriceIssue` con mensajes cortos, campo por campo.
      return null;
  }
}

/** Lo que el schema del formulario necesita saber además de los valores. */
export interface ComboFormContext {
  bodyTypeIds: readonly string[];
  /** La suma por separado de cada tipo de carro, en centavos. */
  sums: Readonly<Record<string, number | null>>;
}

/**
 * El schema del formulario: arma el cuerpo y lo valida con `createComboSchema`
 * (la misma regla que el API), y suma la regla del precio fijo por tipo.
 */
export function comboFormSchema(context: ComboFormContext) {
  return z.custom<ComboFormValues>().superRefine((values, ctx) => {
    const parsed = createComboSchema.safeParse(comboPayloadOf(values, context.bodyTypeIds));

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = formPathOf(issue.path);
        if (field !== null) ctx.addIssue({ code: 'custom', path: [field], message: issue.message });
      }
    }

    if (values.pricingMode !== 'FIXED' || values.items.length < 2) return;

    for (const bodyTypeId of context.bodyTypeIds) {
      const issue = fixedPriceIssue(values.prices[bodyTypeId], context.sums[bodyTypeId] ?? null);
      if (issue !== null) {
        ctx.addIssue({ code: 'custom', path: ['prices', bodyTypeId], message: issue });
      }
    }
  });
}

/** El cuerpo ya validado y normalizado que se manda (alta y edición). */
export function comboInputOf(
  values: ComboFormValues,
  bodyTypeIds: readonly string[],
): CreateComboInput {
  return createComboSchema.parse(comboPayloadOf(values, bodyTypeIds));
}

// ---------------------------------------------------------------------------
// Errores del API
// ---------------------------------------------------------------------------

/** Un campo del formulario: los de arriba o el precio de un tipo de carro. */
export type ComboFieldPath = keyof ComboFormValues | `prices.${string}`;

/**
 * Lo que el API rechazó, repartido por campo. `COMBO_NAME_TAKEN` va al nombre;
 * un `422` con `details` marca cada campo (`prices.N.price` es el tipo de carro
 * N del cuerpo, en el orden de `bodyTypeIds`). Lo que no cae en ningún campo
 * sale al pie, con el mensaje del API.
 */
export function comboApiErrors(
  error: { code: string; message: string; details?: unknown },
  bodyTypeIds: readonly string[],
): { fields: [ComboFieldPath, string][]; general: string | null } {
  if (error.code === 'COMBO_NAME_TAKEN') return { fields: [['name', 'Ya existe']], general: null };

  const details = error.details;
  if (typeof details !== 'object' || details === null) {
    return { fields: [], general: error.message };
  }

  // Las reglas que miran la base responden `{ field, bodyTypeIds? }` con el
  // mensaje en `message`: va al campo, o al precio de cada tipo de carro nombrado.
  const { field: named, bodyTypeIds: namedBodyTypes } = details as {
    field?: unknown;
    bodyTypeIds?: unknown;
  };
  if (typeof named === 'string') {
    const targets =
      named === 'prices' && Array.isArray(namedBodyTypes)
        ? namedBodyTypes
            .filter((id): id is string => typeof id === 'string')
            .map((id) => [named, id])
        : [named.split('.')];
    const namedFields = targets
      .map((path) => apiFieldOf(path, bodyTypeIds))
      .filter((field): field is ComboFieldPath => field !== null)
      .map((field): [ComboFieldPath, string] => [field, error.message]);
    if (namedFields.length > 0) return { fields: namedFields, general: null };
  }

  const fields: [ComboFieldPath, string][] = [];
  const seen = new Set<string>();

  for (const [key, message] of Object.entries(details as Record<string, unknown>)) {
    if (typeof message !== 'string') continue;

    const field = apiFieldOf(key.split('.'), bodyTypeIds);
    if (field === null || seen.has(field)) continue;

    seen.add(field);
    fields.push([field, message]);
  }

  return { fields, general: fields.length === 0 ? error.message : null };
}

function apiFieldOf(
  path: readonly string[],
  bodyTypeIds: readonly string[],
): ComboFieldPath | null {
  const [head, second] = path;

  if (head === 'prices') {
    if (second === undefined)
      return bodyTypeIds[0] === undefined ? null : `prices.${bodyTypeIds[0]}`;
    const byIndex = /^\d+$/.test(second) ? bodyTypeIds[Number(second)] : undefined;
    const bodyTypeId = byIndex ?? (bodyTypeIds.includes(second) ? second : undefined);

    return bodyTypeId === undefined ? null : `prices.${bodyTypeId}`;
  }

  return head === undefined ? null : formPathOf([head]);
}
