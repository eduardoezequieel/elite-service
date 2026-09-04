'use client';

import type { Ticket } from '@elite/shared';
import Link from 'next/link';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { useFloorTicketAction, useFloorTickets } from '../hooks/use-floor';

/**
 * La fila del día en la pista.
 *
 * Láminas, no tabla: se lee de un vistazo y se toca con el dedo. Una tabla con
 * seis columnas en una tablet obliga a apuntar, y apuntar con guantes es cómo
 * se marca listo el carro equivocado.
 */
export function FloorQueue() {
  const tickets = useFloorTickets();

  return (
    <div className="flex flex-col">
      <ScreenHeader title="La fila">
        <Button asChild size="lg">
          <Link href="/floor/new">Anotar carro</Link>
        </Button>
      </ScreenHeader>

      {tickets.isPending ? (
        <p className="text-text-dim text-body">Cargando…</p>
      ) : tickets.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {tickets.error.message}
        </p>
      ) : tickets.data.length === 0 ? (
        <EmptyState
          title="La fila está vacía"
          description="No hay carros en la fila. Tocá «Anotar carro» para empezar."
          action={
            <Button asChild size="lg">
              <Link href="/floor/new">Anotar carro</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {tickets.data.map((ticket) => (
            <QueueCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueCard({ ticket }: { ticket: Ticket }) {
  const ready = useFloorTicketAction('ready');
  const { toast } = useToast();
  const sequence = Number(ticket.number.slice(ticket.number.indexOf('-') + 1));

  return (
    <Card className="gap-3.5 px-card">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <PlateChip plate={ticket.vehicle.plate} size="lg" />
          <p className="text-text-dim mt-2 text-body">
            #{sequence} · {ticket.bodyType.name} · {ticket.customer.fullName}
          </p>
        </div>
        <TicketStatusStamp status={ticket.status} />
      </div>

      <p className="text-text-faint text-body">
        {ticket.items.map((item) => item.serviceName).join(' · ')}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-figure text-text tabular-nums">${ticket.total}</span>
        <div className="flex flex-wrap gap-2 max-md:w-full">
          <Button asChild variant="outline" className="max-md:w-full">
            <Link href={`/floor/${ticket.id}`}>Ver</Link>
          </Button>
          {/* Cualquier empleado activo marca listo, aunque lo haya anotado
              otro: la fila es del taller, no de quien la escribió (RN-9). */}
          {ticket.status === 'OPEN' ? (
            <Button
              type="button"
              className="max-md:w-full"
              loading={ready.isPending}
              onClick={() =>
                ready.mutate(ticket.id, {
                  onSuccess: () => toast({ title: `Lavado #${sequence} marcado listo` }),
                })
              }
            >
              Marcar listo
            </Button>
          ) : null}
        </div>
      </div>

      {ready.error ? (
        <p className="text-danger-text text-body" role="alert">
          {ready.error.message}
        </p>
      ) : null}
    </Card>
  );
}
