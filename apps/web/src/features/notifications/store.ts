import type { Notification, NotificationKind } from './notification';

/**
 * La bandeja, como dato puro (spec 042).
 *
 * Vive en el navegador y no en la base: es un registro de la jornada, no un
 * documento. Eso la deja sin tabla, sin migracion y sin endpoints, y el precio
 * —declarado— es que otra maquina empieza de cero.
 */

/**
 * Cuantos avisos se guardan. El tope subio con el cajon (058): la bandeja pasó
 * de ser la jornada a ser la semana, y 50 se comían el martes a media mañana.
 */
export const NOTIFICATION_LIMIT = 200;

/**
 * Cuantos dias se guardan, contando hoy.
 *
 * Una semana: es lo que alguien puede querer mirar hacia atras —«el carro que
 * entró el viernes»— sin que la bandeja se vuelva un archivo. Lo que no entra
 * en estos dias no se reconstruye desde ningun lado, y esta bien: la verdad de
 * un lavado esta en su linea de tiempo (046), no acá.
 */
export const NOTIFICATION_DAYS = 7;

/**
 * Agrega un aviso al frente.
 *
 * Deduplica por id porque una reconexion de `EventSource` puede reenviar lo que
 * ya llego, y un mismo cambio contado dos veces infla el contador de no leidos.
 */
export function addNotification(
  current: readonly Notification[],
  incoming: Notification,
): Notification[] {
  if (current.some((item) => item.id === incoming.id)) return [...current];

  return [incoming, ...current].slice(0, NOTIFICATION_LIMIT);
}

const KINDS: readonly string[] = [
  'in',
  'move',
  'cash',
  'void',
  'stock',
] satisfies NotificationKind[];

/**
 * Lo que hay en `localStorage` puede ser de una version anterior del sistema:
 * la 058 le agrego el `kind` a cada aviso, y los que quedaron guardados de
 * antes no lo tienen. Se descartan en vez de completarse a mano —un aviso de
 * cobro al que se le inventa el tipo terminaria a la vista de quien no ve el
 * dinero— y la bandeja vuelve a llenarse sola con el hilo.
 */
export function parseStored(raw: unknown): Notification[] {
  return Array.isArray(raw) ? raw.filter(isNotification) : [];
}

function isNotification(value: unknown): value is Notification {
  if (typeof value !== 'object' || value === null) return false;

  const item = value as Partial<Notification>;

  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.description === 'string' &&
    typeof item.href === 'string' &&
    typeof item.at === 'string' &&
    typeof item.kind === 'string' &&
    KINDS.includes(item.kind)
  );
}

export function markAllRead(current: readonly Notification[]): Notification[] {
  return current.map((item) => (item.read ? item : { ...item, read: true }));
}

export function markRead(current: readonly Notification[], id: string): Notification[] {
  return current.map((item) => (item.id === id && !item.read ? { ...item, read: true } : item));
}

export function unreadCount(current: readonly Notification[]): number {
  return current.filter((item) => !item.read).length;
}

/**
 * Deja los de los ultimos `days` dias, contando hoy (058).
 *
 * Se poda al leer y no con un temporizador: lo unico que importa es que no
 * aparezca viejo al abrir. Lo que no tiene fecha legible se tira antes de
 * mostrar un «Invalid Date» en una cabecera de dia.
 */
export function pruneToDays(
  current: readonly Notification[],
  now: Date,
  days: number = NOTIFICATION_DAYS,
): Notification[] {
  const oldest = startOfDay(now);
  oldest.setDate(oldest.getDate() - (days - 1));

  return current.filter((item) => {
    const at = new Date(item.at);

    return !Number.isNaN(at.getTime()) && at.getTime() >= oldest.getTime();
  });
}

/**
 * La clave del dia local de un aviso. Agrupa el cajon y nombra los botones de
 * dia; es local a proposito, porque la bandeja es de esta maquina.
 */
export function dayKeyOf(at: string): string {
  const date = new Date(at);

  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);

  copy.setHours(0, 0, 0, 0);

  return copy;
}
