import { isCivil, type CivilDate } from '@/lib/civil-date';
import { singleParam, type SearchValue } from '@/lib/list-params';

/**
 * El estado de la lista de lavados en la URL (056): el día y la búsqueda. La
 * ficha que se abre desde una fila vuelve acá con los dos puestos. Se lee de
 * `useSearchParams` y se escribe con `replaceQuery` de `lib/list-params` (076).
 */
export interface TicketsListParams {
  /** `null` si la URL no trae un día válido: la pantalla arranca en hoy. */
  date: CivilDate | null;
  search: string;
}

export function ticketsListFrom(values: {
  date?: SearchValue;
  q?: SearchValue;
}): TicketsListParams {
  const date = singleParam(values.date);

  return {
    date: date !== null && isCivil(date) ? date : null,
    search: singleParam(values.q) ?? '',
  };
}

/**
 * El día va siempre, aunque sea hoy: el origen que anota una fila (056) tiene
 * que volver al mismo día aunque el reloj ya haya pasado la medianoche. La
 * búsqueda, solo si hay.
 */
export function ticketsListQuery(state: { date: CivilDate; search: string }): string {
  const params = new URLSearchParams();

  params.set('date', state.date);
  if (state.search.trim() !== '') params.set('q', state.search.trim());

  return params.toString();
}
