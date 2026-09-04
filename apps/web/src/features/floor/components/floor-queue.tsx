'use client';

import type { Ticket } from '@elite/shared';
import Link from 'next/link';

import { useState } from 'react';
import { Search } from 'lucide-react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { readyUndoToast } from '@/features/carwash/ready-undo';
import { useFloorTicketAction, useFloorTickets } from '../hooks/use-floor';

/**
 * La fila del día en la pista.
 *
 * Láminas, no tabla: se lee de un vistazo y se toca con el dedo. Una tabla con
 * seis columnas en una tablet obliga a apuntar, y apuntar con guantes es cómo
 * se marca listo el carro equivocado.
 */
export function FloorQueue() {
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const searching = search !== '';

  const tickets = useFloorTickets({ q: searching ? search : undefined });

  return (
    <div className="flex flex-col">
      <ScreenHeader title="La fila">
        <Button asChild size="lg">
          <Link href="/floor/new">Anotar carro</Link>
        </Button>
      </ScreenHeader>

      <div className="mb-4">
        <FieldBox className="min-h-(--control-h) justify-center">
          <Label htmlFor="floor-search">Buscar por placa, número o cliente</Label>
          <div className="flex items-center gap-2">
            <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
            <Input
              id="floor-search"
              className="min-w-0 flex-1"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="P123-456, #14 o Juan Pérez"
              autoComplete="off"
            />
          </div>
        </FieldBox>
      </div>

      {tickets.isPending ? (
        <p className="text-text-dim text-body">Cargando…</p>
      ) : tickets.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {tickets.error.message}
        </p>
      ) : tickets.data.length === 0 ? (
        <EmptyState
          title={searching ? 'Ningún lavado coincide' : 'La fila está vacía'}
          description={
            searching
              ? `No hay placa, número ni cliente que coincida con «${search}».`
              : 'No hay carros en la fila. Tocá «Anotar carro» para empezar.'
          }
          action={
            searching ? undefined : (
              <Button asChild size="lg">
                <Link href="/floor/new">Anotar carro</Link>
              </Button>
            )
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
  const reopen = useFloorTicketAction('reopen');
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
                  onSuccess: () =>
                    toast(
                      readyUndoToast(sequence, () =>
                        reopen.mutate(ticket.id, {
                          onSuccess: () => toast({ title: `Lavado #${sequence} reabierto` }),
                          onError: (error) => toast({ title: error.message, tone: 'error' }),
                        }),
                      ),
                    ),
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
