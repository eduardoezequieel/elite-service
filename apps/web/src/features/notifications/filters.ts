import type { PermissionKey } from '@elite/shared';

import type { Notification, NotificationKind } from './notification';
import { dayKeyOf } from './store';

/**
 * El recorte de la bandeja (spec 058).
 *
 * Logica pura y sin React: que «Hoy» sea hoy, que los contadores cuadren con lo
 * que se ve y que buscar `#7` no traiga el lavado ajeno son cosas que se
 * prueban con un test, no mirando el cajon.
 */

/** El dia elegido, o todos. La clave la da `dayKeyOf`. */
export type DayFilter = string;

/** El tipo elegido, o todos. */
export type KindFilter = NotificationKind | 'all';

export const ALL_DAYS: DayFilter = 'all';

export interface NotificationFilter {
  day: DayFilter;
  kind: KindFilter;
  unreadOnly: boolean;
  query: string;
}

export const EMPTY_FILTER: NotificationFilter = {
  day: ALL_DAYS,
  kind: 'all',
  unreadOnly: false,
  query: '',
};

/**
 * Los tipos, en el orden en que se ofrecen.
 *
 * `cash` esta en la lista, pero el cajon no lo dibuja si quien mira no tiene
 * `carwash.cash`: un chip que siempre dice 0 es una puerta cerrada con cartel.
 * Lo mismo `stock` sin `inventory.read` (065): ver {@link visibleKinds}.
 */
export const NOTIFICATION_KINDS: readonly { kind: KindFilter; label: string }[] = [
  { kind: 'all', label: 'Todos' },
  { kind: 'in', label: 'Entradas' },
  { kind: 'move', label: 'Avances' },
  { kind: 'cash', label: 'Cobros' },
  { kind: 'void', label: 'Anulados' },
  { kind: 'stock', label: 'Inventario' },
];

/**
 * Los tipos que se ofrecen a quien mira. Cada tipo restringido sale del
 * permiso que decide si esos avisos llegan a guardarse (058, 065): sin él la
 * bandeja nunca tiene uno, y el chip diría 0 para siempre.
 */
export function visibleKinds(
  can: (permission: PermissionKey) => boolean,
): readonly { kind: KindFilter; label: string }[] {
  return NOTIFICATION_KINDS.filter(
    (entry) =>
      (entry.kind !== 'cash' || can('carwash.cash')) &&
      (entry.kind !== 'stock' || can('inventory.read')),
  );
}

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Un dia de la bandeja, ya contado. */
export interface DayGroup {
  key: string;
  /** «Hoy», «Ayer» o «vie 18». */
  label: string;
  /** La fecha corta, siempre: «18 sep». El rotulo relativo solo no ubica. */
  date: string;
  unread: number;
  items: readonly Notification[];
}

/** Busca en lo que el usuario tiene a la vista: el titular y la placa. */
export function matchesQuery(item: Notification, query: string): boolean {
  const needle = query.trim().toLowerCase();

  if (needle === '') return true;

  return (
    item.title.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle)
  );
}

export function matchesFilter(item: Notification, filter: NotificationFilter): boolean {
  if (filter.day !== ALL_DAYS && dayKeyOf(item.at) !== filter.day) return false;
  if (filter.kind !== 'all' && item.kind !== filter.kind) return false;
  if (filter.unreadOnly && item.read) return false;

  return matchesQuery(item, filter.query);
}

export function filterNotifications(
  items: readonly Notification[],
  filter: NotificationFilter,
): Notification[] {
  return items.filter((item) => matchesFilter(item, filter));
}

/** Cuantos hay de cada tipo, para el numero del chip. */
export function countOfKind(items: readonly Notification[], kind: KindFilter): number {
  return kind === 'all' ? items.length : items.filter((item) => item.kind === kind).length;
}

/**
 * El rotulo de un dia: relativo cuando ayuda, con la fecha corta siempre.
 *
 * El dia se compara por su clave local y no por la diferencia en milisegundos:
 * a las 00:30 la resta dice «hace 8 horas» y el rotulo tiene que decir «Hoy».
 */
export function dayLabelOf(at: string, now: Date): { label: string; date: string } {
  const date = new Date(at);

  if (Number.isNaN(date.getTime())) return { label: 'Sin fecha', date: '' };

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const short = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const key = dayKeyOf(at);

  if (key === dayKeyOf(now.toISOString())) return { label: 'Hoy', date: short };
  if (key === dayKeyOf(yesterday.toISOString())) return { label: 'Ayer', date: short };

  return { label: `${DAY_NAMES[date.getDay()]} ${date.getDate()}`, date: short };
}

/**
 * Agrupa por dia respetando el orden que ya trae la bandeja: lo mas nuevo
 * arriba. No reordena nada, solo corta.
 */
export function groupByDay(items: readonly Notification[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const item of items) {
    const key = dayKeyOf(item.at);
    const existing = groups.find((group) => group.key === key);

    if (existing === undefined) {
      const { label, date } = dayLabelOf(item.at, now);

      groups.push({ key, label, date, unread: item.read ? 0 : 1, items: [item] });
      continue;
    }

    existing.items = [...existing.items, item];
    if (!item.read) existing.unread += 1;
  }

  return groups;
}
