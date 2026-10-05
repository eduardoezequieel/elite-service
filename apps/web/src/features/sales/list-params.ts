import { isCivil, type CivilDate } from '@/lib/civil-date';
import { singleParam, type SearchValue } from '@/lib/list-params';

/**
 * El día de la lista de ventas en la URL (056): volver de la ficha lo
 * conserva. Se lee de `useSearchParams` y se escribe con `replaceQuery` (076).
 */

/** El día de la URL, o `null` si no trae uno válido: la pantalla arranca en hoy. */
export function salesDateFrom(value: SearchValue): CivilDate | null {
  const date = singleParam(value);

  return date !== null && isCivil(date) ? date : null;
}

/** El día va siempre, aunque sea hoy. */
export function salesListQuery(date: CivilDate): string {
  return new URLSearchParams({ date }).toString();
}

/** Las dos pestañas de Ventas (105): el día y las cuentas abiertas. */
export type SalesSection = 'day' | 'tabs';

/**
 * La pestaña activa sale de la ruta, como en Inventario (092): el marco vive en
 * el layout del grupo `(tabs)`. Todo lo que no es Cuentas abiertas es el día.
 */
export function salesSectionFor(pathname: string): SalesSection {
  return pathname === '/sales/tabs' ? 'tabs' : 'day';
}
