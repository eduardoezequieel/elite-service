import { isCivil, presetRange, type CivilRange } from '@/lib/civil-date';

/**
 * El rango de comisiones viaja en la URL (spec 061) para que el regreso del
 * detalle vuelva al reporte con el mismo rango puesto. Se llama `start`/`end`
 * porque `from` ya es el origen del enlace de regreso (spec 056).
 */
export const RANGE_START_PARAM = 'start';
export const RANGE_END_PARAM = 'end';

type SearchValue = string | string[] | undefined | null;

function single(value: SearchValue): string | null {
  return typeof value === 'string' ? value : null;
}

/** El rango de la URL si es válido; si no, el mes en curso. */
export function commissionRangeFrom(start: SearchValue, end: SearchValue): CivilRange {
  const from = single(start);
  const to = single(end);

  if (from !== null && to !== null && isCivil(from) && isCivil(to) && from <= to) {
    return { from, to };
  }

  return presetRange('month');
}

/** `start=…&end=…`, para colgar de una ruta. */
export function commissionRangeQuery(range: CivilRange): string {
  const params = new URLSearchParams({
    [RANGE_START_PARAM]: range.from,
    [RANGE_END_PARAM]: range.to,
  });

  return params.toString();
}
