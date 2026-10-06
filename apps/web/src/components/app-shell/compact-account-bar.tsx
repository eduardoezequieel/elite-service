'use client';

import { useWorkspaces } from '@/components/app-shell/nav-items';
import { UserMenu } from '@/components/app-shell/user-menu';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { NotificationBell } from '@/features/notifications/components/notification-bell';

/**
 * Cuenta en pantallas chicas de la renta (107), donde la barra de abajo no
 * tiene «Más». Tema, densidad, campana y salir van arriba, y solo ahí: el
 * riel de escritorio ya los tiene. Lavado y Administración no la ven.
 */
export function CompactAccountBar() {
  const { active } = useWorkspaces();
  if (active?.key !== 'rentals') return null;

  return (
    <div
      data-slot="compact-account-bar"
      className="border-line bg-surface sticky top-0 z-20 flex items-center justify-end gap-1 border-b px-2 py-1 md:hidden"
    >
      <RequirePermission permission="notifications.read">
        <NotificationBell collapsed />
      </RequirePermission>
      <UserMenu collapsed showWorkspaces side="bottom" align="end" />
    </div>
  );
}
