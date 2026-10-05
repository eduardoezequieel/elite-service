import type { ComboPricingMode, TicketItemKind } from '@elite/shared';

import type { Milli } from '../../inventory/domain/stock';
import type { Cents } from '../../carwash/domain/money';
import type { BodyTypePrice } from '../../carwash/domain/pricing';

/**
 * Precio y prorrateo de un combo (104 RN-2, RN-5). Reglas puras, todo en
 * centavos enteros y con `bigint` en las multiplicaciones: un combo es una
 * suma exacta de líneas y un flotante la rompería por un centavo.
 */

/** Milésimas por unidad: la cantidad de un componente es entera (RN-1). */
const MILLI_PER_UNIT = 1000;

/** Un componente del combo con lo que hace falta para cotizarlo. */
export interface ComboComponent {
  kind: TicketItemKind;
  /** Solo en `SERVICE`. */
  serviceId: string | null;
  /** Solo en `PRODUCT`. */
  inventoryItemId: string | null;
  code: string;
  name: string;
  /** `"0.1300"`, el del servicio o el del producto. */
  taxRate: string;
  /** Entero de 1 a 10; siempre 1 en un servicio (RN-1). */
  quantity: number;
  /** Servicio: su precio base; producto: su precio de venta. */
  defaultPrice: Cents;
  /** La matriz del servicio por tipo de carro. Vacía en un producto. */
  prices: readonly BodyTypePrice[];
  /** Existencia del producto; `null` en un servicio. */
  stockOnHand: Milli | null;
}

/** Lo que decide cuánto cuesta un combo. */
export interface ComboPricing {
  pricingMode: ComboPricingMode;
  /** Solo en `PERCENT`. */
  discountPercent: number | null;
  /** Solo en `FIXED`: un precio por tipo de carro. */
  fixedPrices: readonly BodyTypePrice[];
  components: readonly ComboComponent[];
}

/**
 * Precio de lista de **una unidad** del componente para ese tipo de carro: la
 * fila de la matriz del servicio o, sin ella, su base (RN-2 de la 003); un
 * producto tiene un solo precio.
 */
export function unitListPrice(component: ComboComponent, bodyTypeId: string): Cents {
  const row = component.prices.find((price) => price.bodyTypeId === bodyTypeId);

  return row?.price ?? component.defaultPrice;
}

/** La suma por separado de ese tipo de carro: precio de lista × cantidad. */
export function listPriceFor(components: readonly ComboComponent[], bodyTypeId: string): Cents {
  return components.reduce(
    (sum, component) => sum + unitListPrice(component, bodyTypeId) * component.quantity,
    0,
  );
}

/** `list × (100 − percent) / 100`, redondeado al centavo con mitad hacia arriba (criterio 2). */
export function discountedPrice(list: Cents, percent: number): Cents {
  const scaled = BigInt(list) * BigInt(100 - percent);

  return Number((scaled + 50n) / 100n);
}

/**
 * El precio del combo para ese tipo de carro. `PERCENT` se calcula sobre la
 * suma de hoy; `FIXED` es el guardado. Un tipo de carro sin precio fijo —uno
 * creado después del combo— cobra la suma por separado: sin descuento, pero sin
 * dejar al cajero sin poder vender.
 */
export function comboPriceFor(pricing: ComboPricing, bodyTypeId: string): Cents {
  const list = listPriceFor(pricing.components, bodyTypeId);

  if (pricing.pricingMode === 'PERCENT') {
    return discountedPrice(list, pricing.discountPercent ?? 0);
  }

  return pricing.fixedPrices.find((row) => row.bodyTypeId === bodyTypeId)?.price ?? list;
}

/** Una línea a prorratear: su precio de lista unitario y cuántas. */
export interface ProrateLine {
  kind: TicketItemKind;
  unitListPrice: Cents;
  /** Entera. */
  quantity: number;
}

/**
 * Reparte el precio del combo entre sus líneas (RN-5) y devuelve el precio
 * unitario de cada una, en el mismo orden.
 *
 * - Cada línea recibe `precio × lista_i / suma`, por abajo al centavo. En un
 *   producto se divide por la cantidad antes de redondear, así `unit × qty`
 *   nunca pasa su parte, y además se topa en su precio de lista: ninguna línea
 *   de producto supera su catálogo aunque el precio fijo haya quedado por
 *   encima de la suma porque bajó un servicio.
 * - Todo el residuo va a la **primera línea de servicio** (RN-1 garantiza una),
 *   y la suma de `unit × qty` cierra exacta con el precio del combo.
 * - Con suma cero, todo el precio va a esa misma línea.
 */
export function prorate(lines: readonly ProrateLine[], comboPrice: Cents): Cents[] {
  const firstService = Math.max(
    0,
    lines.findIndex((line) => line.kind === 'SERVICE'),
  );
  const total = lines.reduce((sum, line) => sum + BigInt(line.unitListPrice * line.quantity), 0n);
  const price = BigInt(comboPrice);

  const units = lines.map((line) => {
    if (total === 0n) return 0;

    const share = (price * BigInt(line.unitListPrice)) / total;
    const unit = Number(share);

    return line.kind === 'PRODUCT' ? Math.min(unit, line.unitListPrice) : unit;
  });

  const assigned = units.reduce((sum, unit, index) => sum + unit * lines[index].quantity, 0);

  if (units.length > 0) units[firstService] += comboPrice - assigned;

  return units;
}

/** Una línea del combo ya expandida para un tipo de carro. */
export interface ExpandedComboLine {
  component: ComboComponent;
  /** Precio de lista unitario: el `catalogPrice` de la línea (RN-6). */
  catalogPrice: Cents;
  /** El prorrateado (RN-5). */
  unitPrice: Cents;
}

/**
 * El combo como líneas para ese tipo de carro, en el orden de sus componentes:
 * `catalogPrice` es el de lista, `unitPrice` el prorrateado, y
 * `Σ unitPrice × cantidad` es exactamente `comboPriceFor`.
 */
export function expandCombo(pricing: ComboPricing, bodyTypeId: string): ExpandedComboLine[] {
  const lines = pricing.components.map((component) => ({
    kind: component.kind,
    unitListPrice: unitListPrice(component, bodyTypeId),
    quantity: component.quantity,
  }));
  const units = prorate(lines, comboPriceFor(pricing, bodyTypeId));

  return pricing.components.map((component, index) => ({
    component,
    catalogPrice: lines[index].unitListPrice,
    unitPrice: units[index],
  }));
}

/**
 * Nombres de los productos sin existencia para una unidad del combo: el alta
 * lo muestra deshabilitado con «Sin <producto>» (criterio 5).
 */
export function outOfStockNames(components: readonly ComboComponent[]): string[] {
  return components
    .filter(
      (component) =>
        component.kind === 'PRODUCT' &&
        component.stockOnHand !== null &&
        component.stockOnHand < component.quantity * MILLI_PER_UNIT,
    )
    .map((component) => component.name);
}
