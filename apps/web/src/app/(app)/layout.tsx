import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell/app-shell';
import { SessionGuard } from '@/components/app-shell/session-guard';
import { CarwashLiveProvider } from '@/features/carwash/components/carwash-live-provider';
import { NotificationsSession } from '@/features/notifications/components/notifications-session';

/**
 * Layout del área autenticada: todo lo que vive detrás de una sesión.
 *
 * Capa de rutas y nada más: la protección la resuelve `<SessionGuard>` y el
 * armazón —riel tabulado y contenido— lo arma `<AppShell>`.
 *
 * El hilo en vivo (042) va acá adentro y no en el layout raíz por dos razones:
 * necesita una sesión ya resuelta para saber a quién no avisarle, y la pista
 * —que cuelga de otro árbol— tiene su propio hilo con otra cookie.
 */
export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionGuard>
      <NotificationsSession>
        <CarwashLiveProvider>
          <AppShell>{children}</AppShell>
        </CarwashLiveProvider>
      </NotificationsSession>
    </SessionGuard>
  );
}
