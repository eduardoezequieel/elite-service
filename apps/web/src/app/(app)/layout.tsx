import type { ReactNode } from 'react';

import { AppShell } from '@/components/app-shell/app-shell';
import { SessionGuard } from '@/components/app-shell/session-guard';

/**
 * Layout del área autenticada: todo lo que vive detrás de una sesión.
 *
 * Capa de rutas y nada más: la protección la resuelve `<SessionGuard>` y el
 * armazón —riel tabulado y contenido— lo arma `<AppShell>`.
 */
export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionGuard>
      <AppShell>{children}</AppShell>
    </SessionGuard>
  );
}
