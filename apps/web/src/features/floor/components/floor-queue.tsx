'use client';

import type { Ticket } from '@elite/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import {
  countActiveFilters,
  ticketBodyTypeOptions,
  ticketMatchesFilters,
  withAllOption,
} from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { statusLabel, TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { timeOf, waitLabel } from '@/features/carwash/wait';
import { washerNames } from '@/features/carwash/washers';
import { useFloorTickets } from '../hooks/use-floor';
import { FloorStatusConfirmDialog, useFloorStatusConfirm } from './floor-status-confirm';

const EMPTY_TICKETS: Ticket[] = [];

const FLOOR_STATUS_OPTIONS = withAllOption('Todos los estados', [
  { value: 'OPEN', label: statusLabel('OPEN') },
  { value: 'WASHING', label: statusLabel('WASHING') },
  { value: 'READY', label: statusLabel('READY') },
]);

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
  const extra = useFilterValues(['bodyTypeId', 'status'] as const);

  const tickets = useFloorTickets({ q: searching ? search : undefined });
  const source = tickets.data ?? EMPTY_TICKETS;
  const extraActive = countActiveFilters(Object.values(extra.values));
  const narrowing = searching || extraActive > 0;
  const visible = useMemo(
    () => source.filter((row) => ticketMatchesFilters(row, extra.values)),
    [extra.values, source],
  );
  const bodyOptions = useMemo(
    () => withAllOption('Todas las carrocerías', ticketBodyTypeOptions(source)),
    [source],
  );

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Lavados activos"
        subtitle={tickets.isFetching ? 'Actualizando…' : 'Se actualiza sola'}
      >
        <Button asChild size="lg">
          <Link href="/floor/new">Anotar carro</Link>
        </Button>
      </ScreenHeader>

      <FilterBar className="mb-4">
        <div className="min-w-[240px] flex-1">
          <FieldBox className="h-full min-h-(--control-h) justify-center">
            <Label htmlFor="floor-search">Buscar por placa, número o cliente</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
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
        <FiltersPopover
          fields={[
            {
              id: 'status',
              label: 'Estado',
              value: extra.values.status,
              options: FLOOR_STATUS_OPTIONS,
              onChange: (value) => extra.set('status', value),
            },
            {
              id: 'bodyType',
              label: 'Carrocería',
              value: extra.values.bodyTypeId,
              options: bodyOptions,
              onChange: (value) => extra.set('bodyTypeId', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      {tickets.isPending ? (
        <p className="text-text-dim text-body">Cargando…</p>
      ) : tickets.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {tickets.error.message}
        </p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={narrowing ? 'Ningún lavado coincide' : 'No tenés carros en la fila'}
          description={
            searching
              ? `No hay placa, número ni cliente que coincida con «${search}».`
              : extraActive > 0
                ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
                : 'Cuando oficina te asigne un lavado o anotes un carro, va a aparecer acá.'
          }
        />
      ) : (
        <div className="grid gap-3">
          {visible.map((ticket) => (
            <QueueCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueCard({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const status = useFloorStatusConfirm(ticket);
  const sequence = Number(ticket.number.slice(ticket.number.indexOf('-') + 1));
  const since = ticket.washingStartedAt ?? ticket.createdAt;
  const href = `/floor/${ticket.id}`;

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      window.open(href, '_blank');
      return;
    }
    router.push(href);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      window.open(href, '_blank');
      return;
    }
    router.push(href);
  };

  return (
    <>
      <Card
        tabIndex={0}
        role="link"
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className="gap-3.5 px-card cursor-pointer transition-colors duration-(--duration-state) ease-standard hover:border-line hover:bg-surface-2"
      >
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
        <p className="text-text-dim text-dense">
          {washerNames(ticket.washers)} · {timeOf(ticket.createdAt)} · {waitLabel(since)}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-figure text-text tabular-nums">${ticket.total}</span>
          {ticket.status === 'OPEN' || ticket.status === 'WASHING' ? (
            <div className="flex flex-wrap gap-2 max-md:w-full">
              {ticket.status === 'OPEN' ? (
                <Button type="button" className="max-md:w-full" onClick={() => status.ask('start')}>
                  Empezar lavado
                </Button>
              ) : null}
              {ticket.status === 'WASHING' ? (
                <Button type="button" className="max-md:w-full" onClick={() => status.ask('ready')}>
                  Marcar listo
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>
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
    </>
  );
}
