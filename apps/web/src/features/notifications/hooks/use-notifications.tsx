'use client';

import * as React from 'react';

import type { Notification } from '../notification';
import {
  addNotification,
  markAllRead as markAllReadIn,
  markRead as markReadIn,
  pruneToDay,
  unreadCount,
} from '../store';

/**
 * La bandeja de avisos de la jornada (spec 042).
 *
 * Vive en este navegador, por usuario. No es una tabla: es lo que pasó mientras
 * esta persona tenía el sistema abierto. Sobrevive a recargar, se poda sola al
 * día siguiente y no viaja a ninguna otra máquina — está declarado así en la
 * spec, no es un olvido.
 */

const STORAGE_PREFIX = 'elite-notifications:';

export interface NotificationsContextValue {
  items: readonly Notification[];
  unread: number;
  push: (notification: Notification) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
}

const EMPTY: NotificationsContextValue = {
  items: [],
  unread: 0,
  push: () => {},
  markAllRead: () => {},
  markRead: () => {},
};

const NotificationsContext = React.createContext<NotificationsContextValue>(EMPTY);

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function read(userId: string): Notification[] {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(userId));

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? pruneToDay(parsed as Notification[], new Date()) : [];
  } catch {
    // Almacenamiento bloqueado o contenido corrupto: se empieza vacío. Perder
    // la bandeja nunca puede impedir usar el sistema.
    return [];
  }
}

function write(userId: string, items: readonly Notification[]): void {
  try {
    globalThis.localStorage?.setItem(storageKey(userId), JSON.stringify(items));
  } catch {
    // No poder recordar los avisos no rompe nada: la pantalla ya está al día.
  }
}

export function NotificationsProvider({
  userId,
  children,
}: {
  /** `null` mientras no hay sesión resuelta: ahí no se guarda nada. */
  userId: string | null;
  children: React.ReactNode;
}) {
  const [items, setItems] = React.useState<readonly Notification[]>([]);

  // La lectura va en efecto y no en el estado inicial: el servidor no tiene
  // `localStorage` y el HTML tiene que salir igual de los dos lados.
  React.useEffect(() => {
    setItems(userId === null ? [] : read(userId));
  }, [userId]);

  const update = React.useCallback(
    (next: (current: readonly Notification[]) => Notification[]) => {
      setItems((current) => {
        const updated = next(current);

        if (userId !== null) write(userId, updated);

        return updated;
      });
    },
    [userId],
  );

  const value = React.useMemo<NotificationsContextValue>(
    () => ({
      items,
      unread: unreadCount(items),
      push: (notification) => update((current) => addNotification(current, notification)),
      markAllRead: () => update(markAllReadIn),
      markRead: (id) => update((current) => markReadIn(current, id)),
    }),
    [items, update],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/**
 * La bandeja desde cualquier pantalla.
 *
 * Sin proveedor devuelve una bandeja vacía en vez de reventar: la pista monta
 * el stream pero no el centro, y no tiene por qué saberlo.
 */
export function useNotifications(): NotificationsContextValue {
  return React.useContext(NotificationsContext);
}
