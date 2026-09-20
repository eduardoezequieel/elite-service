'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isHeartbeat } from '@elite/shared';

import { useToast } from '@/components/toast-provider';
import { referenceOf } from '@/features/carwash/reference';
import { openStream, type StreamStatus } from '@/lib/realtime';
import { FLOOR_TICKETS_KEY, useFloorSession } from '../hooks/use-floor';
import { FloorLiveContext } from '../hooks/use-floor-live';

/**
 * El hilo de pista (spec 042).
 *
 * El recorte lo hace el servidor: por acá solo llega lo que es de este empleado
 * y está en la fila (036). Aun así el aviso se limita a lo que **no** hizo él:
 * la tablet ya le mostró su propio toque.
 *
 * No hay campana en pista. El empleado no tiene roles ni permisos, trabaja de
 * pie y con guantes, y una bandeja con historial es una pantalla más que mirar.
 * Lo único que necesita saber sin ir a buscarlo es que le entró un carro.
 */
export function FloorLiveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useFloorSession();
  const [status, setStatus] = React.useState<StreamStatus>('offline');

  const employeeId = session?.employee.id ?? null;

  // Referencias para que el hilo no se corte y se reabra cada vez que cambia
  // una función: reconectar por eso perdería eventos.
  const toastRef = React.useRef(toast);
  const employeeRef = React.useRef(employeeId);

  toastRef.current = toast;
  employeeRef.current = employeeId;

  React.useEffect(() => {
    if (employeeId === null) {
      setStatus('offline');
      return;
    }

    return openStream('floor/stream', {
      onStatus: setStatus,
      onMessage: (message) => {
        if (isHeartbeat(message)) return;

        void queryClient.invalidateQueries({ queryKey: FLOOR_TICKETS_KEY });

        const landed = message.type === 'ticket.assigned' || message.type === 'ticket.created';
        const mine = message.actor?.id === employeeRef.current;

        if (!landed || mine) return;

        // Quién te lo asignó, igual que en la campana de oficina: casi siempre
        // es el mostrador, y saberlo evita ir a preguntar.
        const by = message.actor === null ? '' : ` · ${message.actor.name}`;

        toastRef.current({
          title: `Te asignaron #${referenceOf(message.ticket.number)}`,
          description: `${message.ticket.vehicle.plate}${by}`,
        });
      },
    });
  }, [employeeId, queryClient]);

  return <FloorLiveContext.Provider value={status}>{children}</FloorLiveContext.Provider>;
}
