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
  ALL_FILTER,
  countActiveFilters,
  ticketBodyTypeOptions,
  ticketMatchesFilters,
  withAllOption,
} from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  statusLabel,
  statusLook,
  TicketStatusStamp,
} from '@/features/carwash/components/ticket-status-stamp';
import { STAMP_TONE_TEXT } from '@/components/ui/stamp';
import { cn } from '@/lib/utils';
import { responsibleLabel } from '@/features/carwash/responsible';
import { timeOf, waitLabel } from '@/features/carwash/wait';
import { washerNames } from '@/features/carwash/washers';
import { FLOOR_REFRESH_LABELS, refreshState } from '@/features/carwash/live-label';
import { useFloorTickets } from '../hooks/use-floor';
import { useFloorLive } from '../hooks/use-floor-live';
import { FloorStatusConfirmDialog, useFloorStatusConfirm } from './floor-status-confirm';
import { ticketItemLabels } from '@/features/carwash/combo-lines';
import { ListSkeleton } from '@/components/ui/skeleton';

const EMPTY_TICKETS: Ticket[] = [];

/**
 * Los chips de estado de la fila (066): a la vista y con su conteo, en vez de
 * un popover que había que abrir con el dedo para saber qué había.
 */
const FLOOR_STATUS_CHIPS: readonly { value: string; label: string }[] = [
  { value: ALL_FILTER, label: 'Todos' },
  { value: 'OPEN', label: statusLabel('OPEN') },
  { value: 'WASHING', label: statusLabel('WASHING') },
  { value: 'READY', label: 'Listos' },
];

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
  const { isLive } = useFloorLive();
  const source = tickets.data ?? EMPTY_TICKETS;
  const extraActive = countActiveFilters(Object.values(extra.values));
  const narrowing = searching || extraActive > 0;
  const visible = useMemo(
    () => source.filter((row) => ticketMatchesFilters(row, extra.values)),
    [extra.values, source],
  );
  // Cada chip cuenta lo que mostraría: la búsqueda y la carrocería sí pesan,
  // el estado elegido no —si no, todos menos el activo dirían cero—.
  const statusCounts = useMemo(() => {
    const pool = source.filter((row) =>
      ticketMatchesFilters(row, { ...extra.values, status: ALL_FILTER }),
    );
    const counts = new Map<string, number>([[ALL_FILTER, pool.length]]);

    for (const row of pool) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

    return counts;
  }, [extra.values, source]);
  const bodyOptions = useMemo(
    () => withAllOption('Todas las carrocerías', ticketBodyTypeOptions(source)),
    [source],
  );

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Lavados activos"
        subtitle={FLOOR_REFRESH_LABELS[refreshState(isLive, tickets.isFetching)]}
      >
        {/* En el celular baja a la barra fija de abajo. */}
        <Button asChild size="lg" className="max-md:hidden">
          <Link href="/floor/new">Anotar carro</Link>
        </Button>
      </ScreenHeader>

      <FilterBar className="mb-4">
        <div className="min-w-60 flex-1">
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

      <div
        role="group"
        aria-label="Filtrar por estado"
        className="-mx-plate mb-4 flex gap-2 overflow-x-auto px-plate pb-0.5 [scrollbar-width:none]"
      >
        {FLOOR_STATUS_CHIPS.map((chip) => {
          const pressed = extra.values.status === chip.value;

          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => extra.set('status', chip.value)}
              className={cn(
                'min-h-touch text-body inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 font-semibold whitespace-nowrap transition-colors duration-(--duration-state) ease-standard',
                pressed
                  ? 'border-flame bg-[color-mix(in_oklab,var(--flame)_10%,var(--surface))] text-text'
                  : 'border-line bg-surface text-text-dim hover:text-text',
              )}
            >
              {chip.label}
              <span className="bg-surface-3 text-text text-dense min-w-6 rounded-full px-2 text-center tabular-nums">
                {statusCounts.get(chip.value) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {tickets.isPending ? (
        <ListSkeleton label="Cargando los lavados" rows={4} />
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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((ticket) => (
            <QueueCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}

      {/* «Anotar carro» al alcance del pulgar en el celular (066). */}
      <div className="sticky bottom-0 z-10 -mx-plate -mb-plate mt-4 bg-linear-to-t from-bg from-70% to-transparent px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        <Button asChild size="lg" className="w-full">
          <Link href="/floor/new">Anotar carro</Link>
        </Button>
      </div>
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
        className="relative gap-3.5 overflow-hidden px-card cursor-pointer transition-colors duration-(--duration-state) ease-standard hover:border-line hover:bg-surface-2"
      >
        {/* La franja del tono del estado (066): la fila se lee por color de
            lejos; el chip de arriba sigue diciendo la palabra. */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-0 w-1 bg-current',
            STAMP_TONE_TEXT[statusLook(ticket.status).tone],
          )}
        />
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <PlateChip plate={ticket.vehicle.plate} size="lg" />
            <p className="text-text-dim mt-2 text-body">
              #{sequence} · {ticket.bodyType.name} · {responsibleLabel(ticket)}
            </p>
          </div>
          <TicketStatusStamp status={ticket.status} />
        </div>

        <p className="text-text text-body font-medium">
          {ticketItemLabels(ticket.items).join(' · ')}
        </p>
        <p className="text-text-dim text-dense flex flex-wrap justify-between gap-x-3 gap-y-1">
          <span>
            {washerNames(ticket.washers)} · Entró {timeOf(ticket.createdAt)}
          </span>
          <span className="text-text font-semibold tabular-nums">{waitLabel(since)}</span>
        </p>

        {/* El botón a todo el ancho de la tarjeta: es lo que se viene a tocar. */}
        {ticket.status === 'OPEN' ? (
          <Button
            type="button"
            size="lg"
            className="mt-auto w-full"
            onClick={() => status.ask('start')}
          >
            Empezar lavado
          </Button>
        ) : null}
        {ticket.status === 'WASHING' ? (
          <Button
            type="button"
            size="lg"
            className="mt-auto w-full"
            onClick={() => status.ask('ready')}
          >
            Marcar listo
          </Button>
        ) : null}
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
