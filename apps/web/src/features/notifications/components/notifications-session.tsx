'use client';

import type { ReactNode } from 'react';

import { useSession } from '@/features/auth/hooks/use-session';

import { NotificationsProvider } from '../hooks/use-notifications';

/**
 * Ata la bandeja al usuario de la sesión (spec 042).
 *
 * La bandeja se guarda por usuario: dos personas que comparten el mostrador y
 * la misma máquina no se pisan los avisos, y cerrar sesión no le deja los
 * pendientes de uno a la vista del siguiente.
 */
export function NotificationsSession({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  return (
    <NotificationsProvider userId={session?.user.id ?? null}>{children}</NotificationsProvider>
  );
}
