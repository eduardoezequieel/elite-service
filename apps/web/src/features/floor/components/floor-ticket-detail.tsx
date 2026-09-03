'use client';

import Link from 'next/link';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';
import { TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { useFloorTicket, useFloorTicketAction } from '../hooks/use-floor';

/**
 * Un lavado visto desde la pista.
 *
 * No hay botón de cobrar ni de anular, y el backend tampoco expone esas rutas
 * para esta sesión: el empleado no cobra (RN-10) y no anula (RN-11). Ocultarlo
 * en la pantalla sin cerrarlo en el API sería decoración.
 */
export function FloorTicketDetail({ id }: { id: string }) {
  const ticket = useFloorTicket(id);
  const ready = useFloorTicketAction('ready');
  const reopen = useFloorTicketAction('reopen');
  const { toast } = useToast();

  if (ticket.isPending) {
    return <p className="text-text-dim text-body">Cargando…</p>;
  }

  if (ticket.error !== null || ticket.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {ticket.error?.message ?? 'No se pudo cargar el lavado.'}
      </p>
    );
  }

  const data = ticket.data;
  const sequence = Number(data.number.slice(data.number.indexOf('-') + 1));

  return (
    <div className="flex flex-col gap-4">
      {/* La placa es el título: es el nombre con el que se reconoce el carro a
          tres metros, que es la distancia a la que se mira esta pantalla. */}
      <ScreenHeader
        title={<PlateChip plate={data.vehicle.plate} size="lg" />}
        subtitle={`#${sequence} · ${data.bodyType.name}`}
      >
        <TicketStatusStamp status={data.status} />
      </ScreenHeader>

      <Card className="gap-2 px-card">
        <p className="text-text-faint text-label">Cliente</p>
        <p className="text-text text-body">{data.customer.fullName}</p>
        {data.customer.phone === null ? null : (
          <p className="text-text-dim text-body">{data.customer.phone}</p>
        )}
        <p className="text-text-faint text-label mt-2">Lavador</p>
        <p className="text-text text-body">{data.washer?.fullName ?? 'Oficina'}</p>
      </Card>

      <Card className="gap-2 px-card">
        <p className="text-text-faint text-label">Servicios</p>
        {data.items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="text-text text-body">{item.serviceName}</span>
            <span className="text-text text-body tabular-nums">${item.unitPrice}</span>
          </div>
        ))}
        <div className="border-line-soft mt-1 flex items-baseline justify-between border-t pt-3">
          <span className="text-text-faint text-label">Total</span>
          <span className="text-figure text-text tabular-nums">${data.total}</span>
        </div>
      </Card>

      {(ready.error ?? reopen.error) ? (
        <p className="text-danger-text text-body" role="alert">
          {(ready.error ?? reopen.error)?.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 max-md:flex-col">
        {data.status === 'OPEN' ? (
          <Button
            type="button"
            size="lg"
            loading={ready.isPending}
            onClick={() =>
              ready.mutate(data.id, {
                onSuccess: () => toast({ title: `Lavado #${sequence} marcado listo` }),
              })
            }
          >
            Marcar listo
          </Button>
        ) : null}
        {data.status === 'READY' ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            loading={reopen.isPending}
            onClick={() =>
              reopen.mutate(data.id, {
                onSuccess: () => toast({ title: `Lavado #${sequence} reabierto` }),
              })
            }
          >
            Reabrir
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="lg">
          <Link href="/floor">Volver a la fila</Link>
        </Button>
      </div>
    </div>
  );
}
