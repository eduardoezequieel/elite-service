/**
 * Existencias, en milésimas enteras (065).
 *
 * Las cantidades se guardan con tres decimales (`Decimal(12, 3)`): medio litro
 * de desengrasante es `0.500`. Igual que el dinero en centavos, adentro del
 * dominio todo es entero para no heredar el error del flotante; la conversion
 * vive en el borde.
 */

/** Una cantidad en milésimas. Con signo en un movimiento: + entra, − sale. */
export type Milli = number;

const MILLI_PER_UNIT = 1000;
const QUANTITY_PLACES = 3;

/** `"2.500"` → `2500`. @throws si no es un decimal de hasta tres cifras. */
export function fromQuantityString(value: string): Milli {
  const match = /^(-?)(\d+)(?:\.(\d{1,3}))?$/.exec(value.trim());

  if (match === null) {
    throw new Error(`Cantidad invalida: ${JSON.stringify(value)}`);
  }

  const [, sign, whole, fraction = ''] = match;
  const milli = Number(whole) * MILLI_PER_UNIT + Number(fraction.padEnd(QUANTITY_PLACES, '0'));

  return sign === '-' ? -milli : milli;
}

/** `2500` → `"2.500"`. */
export function toQuantityString(milli: Milli): string {
  const sign = milli < 0 ? '-' : '';
  const absolute = Math.abs(milli);
  const whole = Math.floor(absolute / MILLI_PER_UNIT);
  const fraction = absolute % MILLI_PER_UNIT;

  return `${sign}${whole}.${String(fraction).padStart(QUANTITY_PLACES, '0')}`;
}

/** No hay existencia para sacar lo que se pide (RN-3). */
export class InsufficientStockError extends Error {
  constructor(
    readonly itemId: string,
    /** Lo que hay, en la cadena de tres decimales que viaja en `details`. */
    readonly available: string,
  ) {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

/** El artículo está desactivado: no se vende ni se despacha (RN-14). */
export class ItemInactiveError extends Error {
  constructor(readonly itemId: string) {
    super('Inventory item is inactive');
    this.name = 'ItemInactiveError';
  }
}

/** Es un insumo: no se vende (RN-1). */
export class ItemNotSellableError extends Error {
  constructor(readonly itemId: string) {
    super('Inventory item is not sellable');
    this.name = 'ItemNotSellableError';
  }
}

/** Es un producto: no se despacha, se anota como consumo (072, 070). */
export class ItemNotDispatchableError extends Error {
  constructor(readonly itemId: string) {
    super('Inventory item is not dispatchable');
    this.name = 'ItemNotDispatchableError';
  }
}

/** El artículo no existe. */
export class InventoryItemNotFoundError extends Error {
  constructor(readonly itemId: string) {
    super('Inventory item not found');
    this.name = 'InventoryItemNotFoundError';
  }
}

/**
 * El saldo tras aplicar un movimiento. Nunca negativo (RN-3).
 *
 * @throws InsufficientStockError si el movimiento dejaría la existencia bajo cero.
 */
export function applyMovement(itemId: string, onHand: Milli, quantity: Milli): Milli {
  const after = onHand + quantity;

  if (after < 0) {
    throw new InsufficientStockError(itemId, toQuantityString(Math.max(onHand, 0)));
  }

  return after;
}

/** Estado del aviso de mínimo tras un movimiento (RN-13). */
export interface LowStockTransition {
  /** `true` si este movimiento cruzó el mínimo viniendo de arriba: hay que avisar. */
  notify: boolean;
  /** El valor nuevo de `lowStockNotified`. */
  notified: boolean;
}

/**
 * Avisa una vez por cruce (RN-13): suena cuando el saldo queda en o bajo el
 * mínimo y todavía no se avisó; se rearma cuando vuelve a pasar el mínimo.
 * Sin mínimo (`0`) nunca avisa.
 */
export function lowStockTransition(
  after: Milli,
  minStock: Milli,
  alreadyNotified: boolean,
): LowStockTransition {
  if (minStock <= 0) {
    return { notify: false, notified: false };
  }

  if (after > minStock) {
    return { notify: false, notified: false };
  }

  return { notify: !alreadyNotified, notified: true };
}
