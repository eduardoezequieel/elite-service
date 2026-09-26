import type { LastWash, LastWashItem } from '@elite/shared';

import { METHOD_LABELS } from './cash-format';
import { isProductLine, lineQuantityLabel, toMilli } from './product-lines';

/**
 * Lo que se sabe del lavado anterior de un carro, en el formato en que se lee.
 *
 * Vive suelto y no dentro del componente para que la ficha «Ya lo conocemos» y
 * el aviso de nota (052) escriban la misma fecha: dos formateadores distintos
 * para el mismo dato terminan siempre con dos fechas distintas en pantalla.
 */

/** «12 ago»: el día del lavado anterior, corto porque va al lado de un rótulo. */
export function lastWashDateLabel(createdAt: string): string {
  return new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short' }).format(
    new Date(createdAt),
  );
}

/**
 * La nota del lavado anterior, ya recortada.
 *
 * Devuelve cadena vacía cuando no hay lavado previo, cuando no tiene nota o
 * cuando la nota son solo espacios: los tres casos se dibujan igual —no se
 * dibuja nada— y ninguna pantalla tiene que distinguirlos (041, 052).
 */
export function lastWashNote(lastWash: LastWash | null): string {
  return lastWash?.notes?.trim() ?? '';
}

/**
 * Quiénes lavaron el carro la vez anterior.
 *
 * Sin lavador no hay hueco que disculpar: ese lavado lo despachó la oficina y
 * así se dice. Los nombres van enteros y separados por «, » porque acá hay
 * ancho de sobra, al revés que el chip de la fila (`washersLabel`, 035), que
 * recorta a «Carlos +1» para caber en una columna.
 */
export function lastWashWashersLabel(lastWash: LastWash): string {
  const named = lastWash.washers.map((name) => name.trim()).filter((name) => name !== '');

  return named.length === 0 ? 'Oficina' : named.join(', ');
}

/**
 * Cómo se pagó el lavado anterior.
 *
 * Sin pagos no está mal contado: el lavado pudo quedar listo y sin cobrar, y
 * decirlo vale más que dejar el pie a medias. El nombre del método sale de
 * `METHOD_LABELS`, el mismo que usa la caja, para que «Efectivo» se escriba
 * igual en las dos pantallas.
 *
 * Un cobro partido se lee entero —«Efectivo + Tarjeta»—: mostrar solo el primer
 * método diría que se pagó de una forma que no fue (059).
 */
export function lastWashPaymentLabel(lastWash: LastWash): string {
  if (lastWash.payments.length === 0) return 'Sin cobrar';

  const methods = [...new Set(lastWash.payments.map((payment) => payment.method))];

  return methods.map((method) => METHOD_LABELS[method]).join(' + ');
}

/**
 * La cantidad de una línea del lavado anterior, como se escribe en el ticket:
 * `2 × $3.00` (065 RN-6). Un servicio es siempre una unidad y no la lleva: `null`.
 * El monto de la derecha es `item.total`, que ya viene multiplicado.
 */
export function lastWashItemQuantityLabel(item: LastWashItem): string | null {
  return isProductLine(item) ? lineQuantityLabel(item.unitPrice, toMilli(item.quantity)) : null;
}
