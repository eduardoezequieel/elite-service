'use client';

import { useNavItems } from '@/components/app-shell/nav-items';
import { UserMenu } from '@/components/app-shell/user-menu';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { NotificationBell } from '@/features/notifications/components/notification-bell';

/**
 * Cuenta en pantallas chicas cuando la barra de abajo no tiene «Más» (107).
 *
 * Con cinco pestañas o menos, tema, densidad, campana y salir no caben en el
 * pie. Van arriba, y solo ahí: el riel de escritorio ya los tiene.
 */
export function CompactAccountBar() {
  const { items } = useNavItems();
  if (items.length === 0 || items.length > 5) return null;

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
