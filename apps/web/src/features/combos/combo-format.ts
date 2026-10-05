import type {
  ComboDetail,
  ComboOptionItem,
  ComboPriceRow,
  ComboStatus,
  VehicleBodyType,
} from '@elite/shared';

import { formatCents, parseCents } from '@/lib/money';

/**
 * Cómo se lee un combo en el catálogo y en el alta (104), sin React: estado,
 * vigencia, componentes y precio. Mínimo texto: una o dos palabras por dato.
 */

export const COMBO_STATUS_LABELS: Record<ComboStatus, string> = {
  LIVE: 'Vigente',
  SCHEDULED: 'Programado',
  EXPIRED: 'Vencido',
  PAUSED: 'Pausado',
};

export const COMBO_STATUS_TONES = {
  LIVE: 'green',
  SCHEDULED: 'blue',
  EXPIRED: 'neutral',
  PAUSED: 'amber',
} as const satisfies Record<ComboStatus, string>;

/** El filtro de la lista: «Todos» o un estado. */
export const COMBO_STATUS_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'LIVE', label: 'Vigentes' },
  { value: 'SCHEDULED', label: 'Programados' },
  { value: 'EXPIRED', label: 'Vencidos' },
  { value: 'PAUSED', label: 'Pausados' },
] as const;

export type ComboStatusFilter = (typeof COMBO_STATUS_FILTERS)[number]['value'];

/** El estado que viaja al API, o nada con «Todos». */
export function comboStatusParam(filter: ComboStatusFilter): ComboStatus | undefined {
  return filter === 'all' ? undefined : filter;
}

/** Los días en el orden de la semana del taller: lunes primero (0 = domingo). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** La letra del botón de cada día: L M M J V S D. */
export const WEEKDAY_LETTERS: Record<number, string> = {
  0: 'D',
  1: 'L',
  2: 'M',
  3: 'M',
  4: 'J',
  5: 'V',
  6: 'S',
};

/** El nombre entero, para el lector de pantalla. */
export const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

const WEEKDAY_SHORT: Record<number, string> = {
  0: 'dom',
  1: 'lun',
  2: 'mar',
  3: 'mié',
  4: 'jue',
  5: 'vie',
  6: 'sáb',
};

const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/**
 * Los días en que vale, cortos: nada si son todos, «Lun a vie», «Fines de
 * semana» o la lista («Lun, mié y vie»).
 */
export function weekdaysLabel(days: readonly number[]): string {
  const set = new Set(days);
  if (set.size >= 7) return '';

  const ordered = WEEK_ORDER.filter((day) => set.has(day));
  const key = ordered.join(',');

  if (key === '1,2,3,4,5') return 'Lun a vie';
  if (key === '6,0') return 'Fines de semana';

  const names = ordered.map((day) => WEEKDAY_SHORT[day]);
  const text =
    names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «5 oct», o «5 oct 2027» si no es del año de hoy. */
export function shortDate(civil: string, today: string): string {
  const [year, month, day] = civil.split('-').map(Number);
  const label = `${day} ${SHORT_MONTHS[month - 1] ?? ''}`;

  return civil.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${year}`;
}

/** «5 oct – 31 dic» o «Desde 5 oct» sin fin. */
export function rangeLabel(
  combo: Pick<ComboDetail, 'validFrom' | 'validTo'>,
  today: string,
): string {
  if (combo.validTo === null) return `Desde ${shortDate(combo.validFrom, today)}`;

  return `${shortDate(combo.validFrom, today)} – ${shortDate(combo.validTo, today)}`;
}

/** La vigencia en una línea: fechas y, si no son todos, los días. */
export function whenLabel(
  combo: Pick<ComboDetail, 'validFrom' | 'validTo' | 'weekdays'>,
  today: string,
): string {
  const days = weekdaysLabel(combo.weekdays);

  return days === '' ? rangeLabel(combo, today) : `${rangeLabel(combo, today)} · ${days}`;
}

/** «Lavado completo · Cera ×2»: lo que trae el combo, en una línea. */
export function componentsLabel(
  items: readonly Pick<ComboOptionItem, 'name' | 'quantity'>[],
): string {
  return items
    .map((item) => (item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name))
    .join(' · ');
}

/** El chip ámbar del primer producto que no alcanza, o `null`. */
export function outOfStockLabel(outOfStock: readonly string[]): string | null {
  const first = outOfStock[0];

  return first === undefined ? null : `Sin ${first.toLowerCase()}`;
}

/** Un precio del combo ya listo para leer, con lo que se ahorra. */
export interface ComboPriceView {
  /** `null` = un solo precio para todos los tipos de carro. */
  bodyTypeName: string | null;
  price: string;
  /** «−$3.00», o `null` si no ahorra nada. */
  saving: string | null;
}

/**
 * Los precios del combo para la lista: uno solo si todos los tipos dan igual
 * (precio y suma por separado), si no uno por tipo en el orden del catálogo.
 */
export function comboPriceViews(
  prices: readonly ComboPriceRow[],
  bodyTypes: readonly Pick<VehicleBodyType, 'id' | 'name'>[],
): ComboPriceView[] {
  const view = (row: ComboPriceRow, bodyTypeName: string | null): ComboPriceView => {
    const saving = parseCents(row.listPrice) - parseCents(row.price);

    return {
      bodyTypeName,
      price: formatCents(parseCents(row.price)),
      saving: saving > 0 ? `−${formatCents(saving)}` : null,
    };
  };
  const first = prices[0];

  if (first === undefined) return [];

  const uniform = prices.every(
    (row) =>
      parseCents(row.price) === parseCents(first.price) &&
      parseCents(row.listPrice) === parseCents(first.listPrice),
  );

  if (uniform) return [view(first, null)];

  const order = new Map(bodyTypes.map((type, index) => [type.id, index]));
  const nameOf = new Map(bodyTypes.map((type) => [type.id, type.name]));

  return [...prices]
    .sort(
      (a, b) =>
        (order.get(a.bodyTypeId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.bodyTypeId) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((row) => view(row, nameOf.get(row.bodyTypeId) ?? '—'));
}
