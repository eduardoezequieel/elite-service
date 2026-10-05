/**
 * spec 104 — Combos del lavado: formas que devuelven `/api/combos`,
 * `GET /api/carwash/combos` y `GET /api/floor/combos`.
 *
 * Dinero como cadena de dos decimales (`"14.00"`), igual que el resto del
 * contrato. La cantidad de un componente es un entero de 1 a 10 (RN-1).
 */

import type { TicketItemKind } from '../contracts';

/** Cómo se pone precio a un combo (RN-2). */
export const COMBO_PRICING_MODES = ['FIXED', 'PERCENT'] as const;
export type ComboPricingMode = (typeof COMBO_PRICING_MODES)[number];

/**
 * Estado derivado con el día civil de hoy en `America/El_Salvador` (RN-3):
 * `PAUSED` si está inactivo; si no, `SCHEDULED` antes de `validFrom`,
 * `EXPIRED` después de `validTo` y `LIVE` en el medio.
 */
export const COMBO_STATUSES = ['LIVE', 'SCHEDULED', 'EXPIRED', 'PAUSED'] as const;
export type ComboStatus = (typeof COMBO_STATUSES)[number];

/** Tope del nombre de un combo. */
export const COMBO_NAME_MAX_LENGTH = 40;
/** Mínimo de componentes de un combo (RN-1). */
export const COMBO_MIN_ITEMS = 2;
/** Tope de la cantidad de un producto dentro del combo (RN-1). */
export const COMBO_MAX_PRODUCT_QUANTITY = 10;
/** Rango del descuento en `PERCENT` (RN-2). */
export const COMBO_MIN_DISCOUNT_PERCENT = 1;
export const COMBO_MAX_DISCOUNT_PERCENT = 90;

/** Días de la semana de la vigencia: 0 = domingo … 6 = sábado (RN-3). */
export const COMBO_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * El precio de un combo para un tipo de carro. `listPrice` es la suma por
 * separado (matriz o base del servicio + precio del producto × cantidad) y
 * `price`, lo que cuesta el combo: el fijo en `FIXED`, el calculado en `PERCENT`.
 */
export interface ComboPriceRow {
  bodyTypeId: string;
  listPrice: string;
  price: string;
}

/** Un componente del combo, tal como lo ve el catálogo. */
export interface ComboItemDetail {
  kind: TicketItemKind;
  /** Solo en `SERVICE`. */
  serviceId: string | null;
  /** Solo en `PRODUCT`. */
  inventoryItemId: string | null;
  code: string;
  name: string;
  /** Entero de 1 a 10; siempre 1 en un servicio. */
  quantity: number;
  /** Existencia del producto, cadena de tres decimales. `null` en un servicio. */
  stockOnHand: string | null;
}

/** `GET /combos`, `GET /combos/:id` y lo que devuelven el alta y la edición. */
export interface ComboDetail {
  id: string;
  /** Correlativo `CMB-0001`. */
  code: string;
  name: string;
  pricingMode: ComboPricingMode;
  /** Solo en `PERCENT`; `null` en `FIXED`. */
  discountPercent: number | null;
  /** Día civil `YYYY-MM-DD`. */
  validFrom: string;
  /** Día civil `YYYY-MM-DD`, o `null` = sin fin. */
  validTo: string | null;
  /** 0 = domingo … 6 = sábado, ordenados. */
  weekdays: number[];
  isActive: boolean;
  status: ComboStatus;
  items: ComboItemDetail[];
  /** Un renglón por **cada** tipo de carro activo, también en `PERCENT`. */
  prices: ComboPriceRow[];
  /** Nombres de los productos sin existencia suficiente para una unidad del combo. */
  outOfStock: string[];
}

/** Un componente del combo en la tarjeta del alta. */
export interface ComboOptionItem {
  kind: TicketItemKind;
  name: string;
  quantity: number;
}

/** Un combo disponible hoy en el alta del lavado (oficina y pista). */
export interface ComboOption {
  id: string;
  name: string;
  items: ComboOptionItem[];
  /** Un renglón por cada tipo de carro activo. */
  prices: ComboPriceRow[];
  /** Nombres de los productos sin existencia: el combo se muestra deshabilitado. */
  outOfStock: string[];
}
