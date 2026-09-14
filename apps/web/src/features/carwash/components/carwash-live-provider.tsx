'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isHeartbeat } from '@elite/shared';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useSession } from '@/features/auth/hooks/use-session';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import { isWorthNotifying, toNotification } from '@/features/notifications/notification';
import { openStream, type StreamStatus } from '@/lib/realtime';
import { CarwashLiveContext } from '../hooks/use-carwash-live';
import { TICKETS_QUERY_KEY } from '../hooks/use-tickets';

/**
 * El hilo de lavados de oficina (spec 042).
 *
 * Se monta una sola vez, detrás de la sesión. Hace dos cosas y ninguna más:
 * invalidar lo que el evento dejó viejo, y anotar en la bandeja lo que no hizo
 * quien está mirando.
 *
 * No pinta nada: la pantalla se actualiza sola porque TanStack Query vuelve a
 * pedir la lista, no porque acá se toque un estado de UI.
 */
export function CarwashLiveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { can } = usePermissions();
  const { push } = useNotifications();
  const [status, setStatus] = React.useState<StreamStatus>('offline');

  const viewerId = session?.user.id ?? null;
  // Mismo permiso que la lista. Sin él no se abre el hilo: el API respondería
  // 403 y `EventSource` se quedaría reintentando contra una puerta cerrada.
  const allowed = can('carwash.read');

  // Las referencias evitan que el hilo se corte y se vuelva a abrir cada vez
  // que cambia una función. Reconectar por eso perdería eventos.
  const pushRef = React.useRef(push);
  const viewerRef = React.useRef(viewerId);

  pushRef.current = push;
  viewerRef.current = viewerId;

  React.useEffect(() => {
    if (!allowed) {
      setStatus('offline');
      return;
    }

    return openStream('carwash/stream', {
      onStatus: setStatus,
      onMessage: (message) => {
        if (isHeartbeat(message)) return;

        // Una sola invalidación por prefijo alcanza a la lista con cualquier
        // filtro y al detalle abierto: las claves ya cuelgan todas de acá.
        void queryClient.invalidateQueries({ queryKey: TICKETS_QUERY_KEY });

        if (isWorthNotifying(message, viewerRef.current)) {
          pushRef.current(toNotification(message));
        }
      },
    });
  }, [allowed, queryClient]);

  return <CarwashLiveContext.Provider value={status}>{children}</CarwashLiveContext.Provider>;
}
