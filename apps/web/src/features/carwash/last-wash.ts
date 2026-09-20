import type { LastWash } from '@elite/shared';

import { METHOD_LABELS } from './cash-format';

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
 * Sin `payment` no está mal contado: el lavado pudo quedar listo y sin cobrar,
 * y decirlo vale más que dejar el pie a medias. El nombre del método sale de
 * `METHOD_LABELS`, el mismo que usa la caja, para que «Efectivo» se escriba
 * igual en las dos pantallas.
 */
export function lastWashPaymentLabel(lastWash: LastWash): string {
  return lastWash.payment === null ? 'Sin cobrar' : METHOD_LABELS[lastWash.payment.method];
}
