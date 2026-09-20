import type { LastWash } from '@elite/shared';

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
