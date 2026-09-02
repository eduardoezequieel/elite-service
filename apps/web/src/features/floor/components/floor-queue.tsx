'use client';

import type { Ticket } from '@elite/shared';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display">La fila</h1>
        <Button asChild size="lg">
          <Link href="/floor/nuevo">Anotar carro</Link>
        </Button>
      </header>

      {tickets.isPending ? (
        <p className="text-muted-foreground text-body">Cargando…</p>
      ) : tickets.error !== null ? (
        <p className="text-stamp-red text-body" role="alert">
          {tickets.error.message}
        </p>
      ) : tickets.data.length === 0 ? (
        <p className="text-muted-foreground text-body">
          No hay carros en la fila. Tocá «Anotar carro» para empezar.
        </p>
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
  const sequence = Number(ticket.number.slice(ticket.number.indexOf('-') + 1));

  return (
    <Card className="flex flex-col gap-3 p-plate">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-headline font-mono">{ticket.vehicle.plate}</p>
          <p className="text-muted-foreground text-body">
            #{sequence} · {ticket.bodyType.name} · {ticket.customer.fullName}
          </p>
        </div>
        <TicketStatusStamp status={ticket.status} />
      </div>

      <p className="text-muted-foreground text-body">
        {ticket.items.map((item) => item.serviceName).join(' · ')}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-figure tabular-nums">${ticket.total}</span>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href={`/floor/${ticket.id}`}>Ver</Link>
          </Button>
          {/* Cualquier empleado activo marca listo, aunque lo haya anotado
              otro: la fila es del taller, no de quien la escribió (RN-9). */}
          {ticket.status === 'OPEN' ? (
            <Button type="button" onClick={() => ready.mutate(ticket.id)}>
              Marcar listo
            </Button>
          ) : null}
        </div>
      </div>

      {ready.error ? (
        <p className="text-stamp-red text-body" role="alert">
          {ready.error.message}
        </p>
      ) : null}
    </Card>
  );
}
