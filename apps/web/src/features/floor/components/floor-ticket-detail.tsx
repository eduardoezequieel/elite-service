'use client';

import type { Ticket } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';
import { TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { washerNames } from '@/features/carwash/washers';
import { useFloorTicket } from '../hooks/use-floor';
import { FloorStatusConfirmDialog, useFloorStatusConfirm } from './floor-status-confirm';

function FloorWashers({ ticket }: { ticket: Ticket }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-text-faint text-label">A cargo de</p>
      <p className="text-text text-body">{washerNames(ticket.washers)}</p>
    </div>
  );
}

/**
 * Un lavado visto desde la pista.
 *
 * No hay botón de cobrar ni de anular, y el backend tampoco expone esas rutas
 * para esta sesión: el empleado no cobra (RN-10) y no anula (RN-11). Ocultarlo
 * en la pantalla sin cerrarlo en el API sería decoración.
 */
export function FloorTicketDetail({ id }: { id: string }) {
  const ticket = useFloorTicket(id);

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

  return <FloorTicketBody ticket={ticket.data} />;
}

function FloorTicketBody({ ticket }: { ticket: Ticket }) {
  const status = useFloorStatusConfirm(ticket);
  const sequence = Number(ticket.number.slice(ticket.number.indexOf('-') + 1));

  return (
    <div className="flex flex-col gap-4">
      {/* La placa es el título: es el nombre con el que se reconoce el carro a
          tres metros, que es la distancia a la que se mira esta pantalla. */}
      <ScreenHeader
        title={<PlateChip plate={ticket.vehicle.plate} size="lg" />}
        subtitle={`#${sequence} · ${ticket.bodyType.name}`}
      >
        <TicketStatusStamp status={ticket.status} />
      </ScreenHeader>

      <Card className="gap-2 px-card">
        <p className="text-text-faint text-label">Cliente</p>
        <p className="text-text text-body">{ticket.customer.fullName}</p>
        {ticket.customer.phone === null ? null : (
          <p className="text-text-dim text-body">{ticket.customer.phone}</p>
        )}
        <FloorWashers ticket={ticket} />
      </Card>

      <Card className="gap-2 px-card">
        <p className="text-text-faint text-label">Servicios</p>
        {ticket.items.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="text-text text-body">{item.serviceName}</span>
            <span className="text-text text-body tabular-nums">${item.unitPrice}</span>
          </div>
        ))}
        <div className="border-line-soft mt-1 flex items-baseline justify-between border-t pt-3">
          <span className="text-text-faint text-label">Total</span>
          <span className="text-figure text-text tabular-nums">${ticket.total}</span>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 max-md:flex-col">
        {ticket.status === 'OPEN' ? (
          <Button type="button" size="lg" onClick={() => status.ask('start')}>
            Empezar lavado
          </Button>
        ) : null}
        {ticket.status === 'WASHING' ? (
          <Button type="button" size="lg" onClick={() => status.ask('ready')}>
            Marcar listo
          </Button>
        ) : null}
        {ticket.status === 'READY' ? (
          <Button type="button" size="lg" variant="outline" onClick={() => status.ask('reopen')}>
            Reabrir
          </Button>
        ) : null}
      </div>

      <FloorStatusConfirmDialog
        open={status.pending !== null}
        title={status.copy?.title ?? ''}
        summary={status.summary}
        confirmLabel={status.copy?.confirm ?? ''}
        loading={status.loading}
        error={status.error}
        onOpenChange={(open) => {
          if (!open) status.cancel();
        }}
        onConfirm={status.confirm}
      />
    </div>
  );
}
