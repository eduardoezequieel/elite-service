/**
 * Costo del inventario, en centavos enteros (065 RN-11).
 *
 * Igual que las existencias en milésimas, adentro del dominio el dinero es
 * entero: el costo promedio se recalcula en cada entrada y un flotante iría
 * acumulando error compra tras compra.
 */
import type { Milli } from './stock';

/** Un monto en centavos. */
export type Cents = number;

const CENTS_PER_UNIT = 100;
const MONEY_PLACES = 2;

/** `"14.50"` → `1450`. @throws si no es un decimal de hasta dos cifras. */
export function fromMoneyString(value: string): Cents {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (match === null) {
    throw new Error(`Monto invalido: ${JSON.stringify(value)}`);
  }

  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * CENTS_PER_UNIT + Number(fraction.padEnd(MONEY_PLACES, '0'));

  return sign === '-' ? -cents : cents;
}

/** `1450` → `"14.50"`. */
export function toMoneyString(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / CENTS_PER_UNIT);
  const fraction = absolute % CENTS_PER_UNIT;

  return `${sign}${whole}.${String(fraction).padStart(MONEY_PLACES, '0')}`;
}

/**
 * Costo promedio ponderado tras una entrada con costo (RN-11).
 *
 * `(existencia × promedio + cantidad × costo) / (existencia + cantidad)`,
 * redondeado al centavo (mitad hacia arriba). Sin existencia previa —o con un
 * saldo que no debería existir, bajo cero— el promedio es el costo de la
 * entrada: no hay nada contra qué ponderar.
 *
 * Se calcula en `bigint`: milésimas por centavos pasan con holgura el entero
 * seguro de JavaScript en un artículo caro con mucha existencia.
 */
export function weightedAverageCost(
  onHand: Milli,
  averageCost: Cents,
  quantity: Milli,
  unitCost: Cents,
): Cents {
  if (quantity <= 0) {
    throw new Error('Una entrada con costo necesita una cantidad mayor que cero');
  }

  if (onHand <= 0) {
    return unitCost;
  }

  const numerator = BigInt(onHand) * BigInt(averageCost) + BigInt(quantity) * BigInt(unitCost);
  const denominator = BigInt(onHand) + BigInt(quantity);
  const rounded = (numerator * 2n + denominator) / (denominator * 2n);

  return Number(rounded);
}
