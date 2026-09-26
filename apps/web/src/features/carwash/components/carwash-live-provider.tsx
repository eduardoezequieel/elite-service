'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isHeartbeat, isInventoryEvent } from '@elite/shared';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useSession } from '@/features/auth/hooks/use-session';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import {
  isWorthNotifying,
  toNotification,
  toStockNotification,
} from '@/features/notifications/notification';
import { openStream, type StreamStatus } from '@/lib/realtime';
import { CarwashLiveContext } from '../hooks/use-carwash-live';
import { CARWASH_QUERY_KEY } from '../hooks/use-tickets';

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
  // El dinero del taller es de quien ve la caja (058): sin `carwash.cash` los
  // avisos de cobro no se guardan. Se decide al recibirlos y no al pintarlos,
  // porque lo que no se puede ver tampoco se archiva en el navegador.
  const seesCash = can('carwash.cash');
  // Lo mismo con el inventario (065): el aviso de mínimo solo se guarda con
  // `inventory.read`, decidido al recibirlo.
  const seesInventory = can('inventory.read');

  // Las referencias evitan que el hilo se corte y se vuelva a abrir cada vez
  // que cambia una función. Reconectar por eso perdería eventos.
  const pushRef = React.useRef(push);
  const viewerRef = React.useRef(viewerId);
  const cashRef = React.useRef(seesCash);
  const inventoryRef = React.useRef(seesInventory);

  pushRef.current = push;
  viewerRef.current = viewerId;
  cashRef.current = seesCash;
  inventoryRef.current = seesInventory;

  React.useEffect(() => {
    if (!allowed) {
      setStatus('offline');
      return;
    }

    return openStream('carwash/stream', {
      onStatus: setStatus,
      // Lo que se movió mientras el hilo estuvo caído no viajó: se pide todo
      // lavados y caja una vez. Sin aviso en la campana, porque no se sabe qué fue.
      onReconnect: () => void queryClient.invalidateQueries({ queryKey: CARWASH_QUERY_KEY }),
      onMessage: (message) => {
        if (isHeartbeat(message)) return;
        // El aviso de mínimo del inventario (065) no mueve lavados ni caja: no
        // invalida nada, solo va a la bandeja de quien ve el inventario. Llega
        // aunque el movimiento lo haya hecho quien mira: lo que se avisa no es
        // su acción, es la existencia en la que quedó el artículo.
        if (isInventoryEvent(message)) {
          if (inventoryRef.current) pushRef.current(toStockNotification(message));
          return;
        }

        // Una sola invalidación por prefijo alcanza a la lista con cualquier
        // filtro, al detalle abierto y a la caja: un cobro de otro mueve el
        // turno aunque la pantalla abierta sea la caja (062).
        void queryClient.invalidateQueries({ queryKey: CARWASH_QUERY_KEY });

        if (!isWorthNotifying(message, viewerRef.current)) return;

        const notification = toNotification(message);

        if (notification.kind === 'cash' && !cashRef.current) return;

        pushRef.current(notification);
      },
    });
  }, [allowed, queryClient]);

  return <CarwashLiveContext.Provider value={status}>{children}</CarwashLiveContext.Provider>;
}
