'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

  if (ticket.isPending) {
    return <p className="text-muted-foreground text-body">Cargando…</p>;
  }

  if (ticket.error !== null || ticket.data === undefined) {
    return (
      <p className="text-stamp-red text-body" role="alert">
        {ticket.error?.message ?? 'No se pudo cargar el lavado.'}
      </p>
    );
  }

  const data = ticket.data;
  const sequence = Number(data.number.slice(data.number.indexOf('-') + 1));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display font-mono">{data.vehicle.plate}</h1>
          <p className="text-muted-foreground text-body">
            #{sequence} · {data.bodyType.name}
          </p>
        </div>
        <TicketStatusStamp status={data.status} />
      </header>

      <Card className="flex flex-col gap-2 p-plate">
        <p className="text-label text-muted-foreground">Cliente</p>
        <p className="text-body">{data.customer.fullName}</p>
        {data.customer.phone === null ? null : (
          <p className="text-muted-foreground text-body">{data.customer.phone}</p>
        )}
        <p className="text-label text-muted-foreground mt-2">Lavador</p>
        <p className="text-body">{data.washer?.fullName ?? 'Oficina'}</p>
      </Card>

      <Card className="flex flex-col gap-2 p-plate">
        <p className="text-label text-muted-foreground">Servicios</p>
        {data.items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="text-body">{item.serviceName}</span>
            <span className="text-body tabular-nums">${item.unitPrice}</span>
          </div>
        ))}
        <div className="border-rule mt-1 flex items-baseline justify-between border-t pt-2">
          <span className="text-label text-muted-foreground">Total</span>
          <span className="text-figure tabular-nums">${data.total}</span>
        </div>
      </Card>

      {(ready.error ?? reopen.error) ? (
        <p className="text-stamp-red text-body" role="alert">
          {(ready.error ?? reopen.error)?.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {data.status === 'OPEN' ? (
          <Button type="button" size="lg" onClick={() => ready.mutate(data.id)}>
            Marcar listo
          </Button>
        ) : null}
        {data.status === 'READY' ? (
          <Button type="button" size="lg" variant="secondary" onClick={() => reopen.mutate(data.id)}>
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
