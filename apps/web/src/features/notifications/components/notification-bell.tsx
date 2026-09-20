'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCarwashLive } from '@/features/carwash/hooks/use-carwash-live';
import { cn } from '@/lib/utils';

import { useNotifications } from '../hooks/use-notifications';
import type { Notification } from '../notification';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/** El color del aviso. Nunca es la única señal: siempre va con su texto. */
const TONE_CLASS: Record<Notification['tone'], string> = {
  go: 'text-go-text',
  danger: 'text-danger-text',
  neutral: 'text-text-dim',
};

/**
 * El centro de notificaciones (spec 042).
 *
 * Vive al pie del riel, junto al usuario: el sistema no tiene barra superior y
 * no se le agrega una para esto. Lo ve quien puede ver la fila de lavados
 * —`carwash.read`—, y quien no, no lo ve en absoluto: oculto, no deshabilitado.
 *
 * Recoge lo que pasó mientras esta persona tenía el sistema abierto, y solo lo
 * que **no** hizo ella. Un contador que sube con cada clic propio no informa.
 */
export function NotificationBell({
  collapsed = false,
  side = 'top',
  align = 'start',
  className,
}: {
  /** Riel plegado: solo el icono. */
  collapsed?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const { items, unread, markAllRead, markRead } = useNotifications();
  const { isLive } = useCarwashLive();

  const label = unread === 0 ? 'Avisos' : `Avisos, ${unread} sin leer`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          aria-label={label}
          className={cn(
            'relative min-h-[var(--touch-min)] min-w-[var(--touch-min)] justify-start gap-2',
            collapsed && 'justify-center px-0',
            className,
          )}
        >
          <Bell className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          {collapsed ? null : <span className="truncate text-dense font-semibold">Avisos</span>}

          {unread === 0 ? null : (
            <span
              className="bg-flame text-rail-text absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-label tabular-nums"
              aria-hidden
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side={side} align={align} className="max-h-96 w-80 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="text-text text-dense font-semibold">Avisos</span>
          <span className="text-text-faint text-label font-normal">
            {isLive ? 'en vivo' : 'sin conexión'}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <p className="text-text-faint px-2 py-4 text-center text-dense">
            Acá van a aparecer los cambios que haga otra persona en la fila de lavados.
          </p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild onSelect={() => markRead(item.id)}>
              <Link href={item.href} className="flex-col items-start gap-0.5">
                <span className="flex w-full items-start gap-2">
                  <span className={cn('text-dense font-semibold', TONE_CLASS[item.tone])}>
                    {item.title}
                  </span>
                  {item.read ? null : (
                    <span
                      className="bg-flame mt-1.5 ml-auto size-2 shrink-0 rounded-full"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="text-text-faint text-label">{item.description}</span>
                {item.by === null ? null : (
                  <span className="text-text-faint text-label">{item.by}</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))
        )}

        {unread === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={markAllRead}>
              <CheckCheck className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
              Marcar todo como leído
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
