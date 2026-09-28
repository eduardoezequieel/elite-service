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
