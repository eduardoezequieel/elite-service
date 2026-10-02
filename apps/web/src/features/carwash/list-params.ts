import { isCivil, type CivilDate } from '@/lib/civil-date';
import { pageParam, singleParam, type SearchValue } from '@/lib/list-params';

/**
 * El estado de la lista de lavados en la URL (056): el día y la búsqueda. La
 * ficha que se abre desde una fila vuelve acá con los dos puestos. Se lee de
 * `useSearchParams` y se escribe con `replaceQuery` de `lib/list-params` (076).
 */
export interface TicketsListParams {
  /** `null` si la URL no trae un día válido: la pantalla arranca en hoy. */
  date: CivilDate | null;
  search: string;
  /** La página de la lista (102), desde 1. */
  page: number;
}

export function ticketsListFrom(values: {
  date?: SearchValue;
  q?: SearchValue;
  page?: SearchValue;
}): TicketsListParams {
  const date = singleParam(values.date);

  return {
    date: date !== null && isCivil(date) ? date : null,
    search: singleParam(values.q) ?? '',
    page: pageParam(values.page),
  };
}

/**
 * El día va siempre, aunque sea hoy: el origen que anota una fila (056) tiene
 * que volver al mismo día aunque el reloj ya haya pasado la medianoche. La
 * búsqueda, solo si hay; la página, solo desde la 2 (102).
 */
export function ticketsListQuery(state: {
  date: CivilDate;
  search: string;
  page?: number;
}): string {
  const params = new URLSearchParams();

  params.set('date', state.date);
  if (state.search.trim() !== '') params.set('q', state.search.trim());
  if (state.page !== undefined && state.page > 1) params.set('page', String(state.page));

  return params.toString();
}
