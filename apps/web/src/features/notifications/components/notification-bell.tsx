'use client';

import { Bell } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { rose } from '@/lib/motion';
import { useChangeMark } from '@/lib/use-motion';
import { cn } from '@/lib/utils';

import { useNotifications } from '../hooks/use-notifications';
import { NotificationsDrawer } from './notifications-drawer';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/**
 * El centro de notificaciones (specs 042 y 058).
 *
 * Vive al pie del riel, junto al usuario: el sistema no tiene barra superior y
 * no se le agrega una para esto. Lo ve quien tiene `notifications.read`, y quien
 * no, no lo ve en absoluto: oculto, no deshabilitado. El permiso lo pide quien
 * monta la campana, no ella.
 *
 * Recoge lo que pasó mientras esta persona tenía el sistema abierto, y solo lo
 * que **no** hizo ella. Un contador que sube con cada clic propio no informa.
 *
 * La campana es el botón; lo que se abre es el cajón de la 058.
 */
export function NotificationBell({
  collapsed = false,
  className,
}: {
  /** Riel plegado: solo el icono. */
  collapsed?: boolean;
  className?: string;
}) {
  const { unread } = useNotifications();
  const [open, setOpen] = React.useState(false);
  // Llegó un aviso: la campana se mece y el globo salta una vez (087). Leer no mueve nada.
  const arrived = useChangeMark(unread, rose);

  const label = unread === 0 ? 'Avisos' : `Avisos, ${unread} sin leer`;

  return (
    <>
      <Button
        variant="ghost"
        size={collapsed ? 'icon' : 'default'}
        aria-label={label}
        onClick={() => setOpen(true)}
        className={cn(
          'relative min-h-(--touch-min) min-w-(--touch-min) justify-start gap-2',
          collapsed && 'justify-center px-0',
          className,
        )}
      >
        <Bell
          data-slot="notification-bell-icon"
          data-changed={arrived}
          className="size-icon"
          strokeWidth={ICON_STROKE_WIDTH}
          aria-hidden
        />
        {collapsed ? null : <span className="truncate text-dense font-semibold">Avisos</span>}

        {unread === 0 ? null : (
          <span
            data-slot="notification-bell-badge"
            data-changed={arrived}
            className="bg-flame text-rail-text absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-label tabular-nums"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      <NotificationsDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
