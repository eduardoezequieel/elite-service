import { quantityMilli } from '@/lib/quantity';

/**
 * La lógica pura de los selectores en línea de los diálogos del inventario
 * (spec 072): el artículo del despacho y de la entrada, y la grilla de «Recibe».
 * Sin React, para poder probarla sola.
 */

/** Existencia 0 o menos: un despacho no puede sacar nada de ahí (072 A). */
export function isOutOfStock(stockOnHand: string): boolean {
  const milli = quantityMilli(stockOnHand);
  return milli !== null && milli <= 0;
}

/**
 * La siguiente opción habilitada en la dirección `step` (+1 abajo, −1 arriba),
 * dando la vuelta. Desde `-1` (ninguna activa) baja a la primera o sube a la
 * última. `-1` si no hay ninguna habilitada.
 */
export function nextEnabledIndex(
  disabled: readonly boolean[],
  current: number,
  step: 1 | -1,
): number {
  const count = disabled.length;
  if (count === 0) return -1;

  let index = current < 0 || current >= count ? (step > 0 ? -1 : count) : current;
  for (let tries = 0; tries < count; tries += 1) {
    index = (index + step + count) % count;
    if (!disabled[index]) return index;
  }

  return -1;
}

/** La primera (`first`) o la última (`last`) habilitada; `-1` si no hay. */
export function edgeEnabledIndex(disabled: readonly boolean[], edge: 'first' | 'last'): number {
  return nextEnabledIndex(disabled, -1, edge === 'first' ? 1 : -1);
}

/**
 * Qué elige Enter en la búsqueda. La activa si hay una habilitada; si no hay
 * activa y la lista —ya asentada para lo que se escribió— trae una sola
 * habilitada, esa: es lo que hace el lector de códigos de barras, que escribe
 * el código y manda Enter. Si no, nada (`-1`).
 */
export function enterPickIndex(
  disabled: readonly boolean[],
  active: number,
  settled: boolean,
): number {
  if (active >= 0 && active < disabled.length && !disabled[active]) return active;
  if (!settled || active >= 0) return -1;

  const enabled = disabled.flatMap((isDisabled, index) => (isDisabled ? [] : [index]));
  return enabled.length === 1 ? enabled[0] : -1;
}

/**
 * La tecla que mueve la grilla de radios: flechas a los dos lados y de arriba
 * abajo, en orden de lectura, dando la vuelta; Home y End a las puntas. `null`
 * si la tecla no es de la grilla.
 */
export function radioKeyIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  const all = Array.from({ length: count }, () => false);

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return nextEnabledIndex(all, current, 1);
    case 'ArrowLeft':
    case 'ArrowUp':
      return nextEnabledIndex(all, current, -1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
