import type { ReactNode } from 'react';

import { SessionGuard } from '@/components/app-shell/session-guard';
import { CarwashLiveProvider } from '@/features/carwash/components/carwash-live-provider';
import { NotificationsSession } from '@/features/notifications/components/notifications-session';

/**
 * Layout del tablero de pista (spec 049): la misma sesión y el mismo hilo en
 * vivo que la oficina, pero **sin `<AppShell>`**.
 *
 * Es un árbol aparte a propósito. El tablero cuelga de una TV en la pista y
 * ocupa la pantalla entera: un riel de 248px al costado le comería una columna
 * de lavador para no decir nada —ahí nadie navega—. Se entra desde el botón
 * «Ver tablero» de `/carwash` y se sale por el enlace de regreso.
 */
export default function BoardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionGuard>
      <NotificationsSession>
        <CarwashLiveProvider>{children}</CarwashLiveProvider>
      </NotificationsSession>
    </SessionGuard>
  );
}
