import type { Notification } from './notification';

/**
 * La bandeja, como dato puro (spec 042).
 *
 * Vive en el navegador y no en la base: es un registro de la jornada, no un
 * documento. Eso la deja sin tabla, sin migracion y sin endpoints, y el precio
 * —declarado— es que otra maquina empieza de cero.
 */

/** Cuantos avisos se guardan. Mas que esto nadie los lee. */
export const NOTIFICATION_LIMIT = 50;

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
 * Deja solo los del dia de `now`.
 *
 * El lavado es un negocio de jornada: el turno de caja se abre y se cierra, y un
 * aviso de ayer no ayuda a nadie a resolver el carro que tiene enfrente. Se poda
 * al leer, no con un temporizador: lo unico que importa es que no aparezca
 * viejo al abrir.
 */
export function pruneToDay(current: readonly Notification[], now: Date): Notification[] {
  const today = civilDay(now);

  return current.filter((item) => civilDay(new Date(item.at)) === today);
}

/** El dia local del aparato. La bandeja es de esta maquina, no del servidor. */
function civilDay(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
