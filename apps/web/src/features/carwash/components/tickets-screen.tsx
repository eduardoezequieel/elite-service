'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Ticket, TicketListSummary } from '@elite/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Car, CheckCircle2, CircleDollarSign, Clock, List, Monitor, Search } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { SegmentGauge } from '@/components/ui/segment-gauge';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { dayLabel, timeLabel, todayCivil } from '@/lib/civil-date';
import {
  countActiveFilters,
  ticketFacetOptions,
  ticketFilterParams,
  withAllOption,
  PENDING_FILTER,
} from '@/lib/list-filters';
import { LIST_PAGE_SIZE, replaceQuery } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useHeldWhileOpen } from '@/lib/use-held-while-open';
import { centsParts, toCents } from '@/lib/money';
import { Pager } from '@/features/inventory/components/pager';
// El dinero viaja como cadena decimal (`"14.00"`) justamente para no pasar por
// un `number`: se suma en centavos enteros y se vuelve a partir para dibujarlo.
import { METHOD_LABELS } from '../cash-format';
import { useCarwashLive } from '../hooks/use-carwash-live';
import { useTickets } from '../hooks/use-tickets';
import { ticketsListFrom, ticketsListQuery } from '../list-params';
import { OFFICE_REFRESH_LABELS, refreshState } from '../live-label';
import { responsibleLabel } from '../responsible';
import { referenceOf } from '../reference';
import { elapsedLabel } from '../elapsed';
import { timeOf } from '../wait';
import { washersLabel } from '../washers';
import { ChargeDialog } from './charge-dialog';
import { TicketStatusStamp } from './ticket-status-stamp';
import { itemLabel } from '../product-lines';

/** Los filtros de la fila. «Pendientes» es lo que el mostrador mira todo el día. */
const FILTERS = [
  { key: 'pending', label: 'Pendientes', status: 'OPEN,WASHING,READY', icon: Clock },
  { key: 'ready', label: 'Listos para cobrar', status: 'READY', icon: CheckCircle2 },
  { key: 'all', label: 'Todos', status: undefined, icon: List },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const EMPTY_TICKETS: Ticket[] = [];

const PAYMENT_OPTIONS = withAllOption('Todos los pagos', [
  { value: PENDING_FILTER, label: 'Pendiente' },
  { value: 'CASH', label: METHOD_LABELS.CASH },
  { value: 'CARD', label: METHOD_LABELS.CARD },
  { value: 'TRANSFER', label: METHOD_LABELS.TRANSFER },
  { value: 'OTHER', label: METHOD_LABELS.OTHER },
]);

/**
 * Cada pestaña tiene su propio vacío: lo que falta en «Pendientes» no es lo
 * mismo que lo que falta en «Todos», y «No hay lavados» no le dice a nadie qué
 * va a aparecer acá.
 */
const EMPTY: Record<FilterKey, { title: string; message: string }> = {
  pending: {
    title: 'Nada pendiente',
    message: 'Cuando entre un carro va a aparecer acá.',
  },
  ready: {
    title: 'Nada por cobrar',
    message: 'Cuando un lavado se marque listo va a aparecer acá para cobrarlo.',
  },
  all: {
    title: 'Hoy no hay lavados',
    message: 'Los lavados del día van a aparecer acá.',
  },
};

/** «Martes 2 de septiembre, 9:42 a.m.» */
function momentLabel(date: Date): string {
  const iso = date.toISOString();

  return `${dayLabel(iso)}, ${timeLabel(iso)}`;
}

/**
 * La hora del mostrador, viva.
 *
 * Se calcula después de montar y se refresca cada minuto: pintarla en el
 * servidor daría la hora del servidor y rompería la hidratación.
 */
function useMomentLabel(): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(momentLabel(new Date()));

    const timer = globalThis.setInterval(() => setLabel(momentLabel(new Date())), 60_000);

    return () => globalThis.clearInterval(timer);
  }, []);

  return label;
}

/** Lo que el mostrador quiere saber del día: el resumen del API, sobre todas las filas (102). */
interface DaySummary {
  queued: number;
  ready: number;
  paidCents: number;
  paidCount: number;
  nonVoid: number;
  pending: number;
  all: number;
}

const EMPTY_SUMMARY: DaySummary = {
  queued: 0,
  ready: 0,
  paidCents: 0,
  paidCount: 0,
  nonVoid: 0,
  pending: 0,
  all: 0,
};

function summarize(summary: TicketListSummary | undefined): DaySummary {
  if (summary === undefined) return EMPTY_SUMMARY;

  return {
    queued: summary.queued,
    ready: summary.ready,
    paidCents: toCents(summary.paidTotal) ?? 0,
    paidCount: summary.paidCount,
    nonVoid: summary.nonVoid,
    pending: summary.queued + summary.ready,
    all: summary.all,
  };
}

/**
 * La fila de lavados de **oficina**.
 *
 * Arriba, el día de un vistazo: cuántos hay en espera, cuántos esperan cobro,
 * cuánto entró y cuánto falta. Debajo, la fila con la acción que toca a cada
 * lavado según su estado y el permiso de quien mira: marcar listo, cobrar o
 * abrir. El cobro sigue pasando por el mismo diálogo del detalle, con el mismo
 * total y la misma advertencia — cobrar sigue siendo lo único que no se
 * deshace.
 */
export function TicketsScreen() {
  const { can } = usePermissions();
  const { isLive } = useCarwashLive();
  const [filter, setFilterState] = useState<FilterKey>('pending');
  /**
   * Solo el id: el ticket sale de la lista en cada render. Si se guarda el
   * objeto, el diálogo se queda con la foto del momento en que se abrió y no ve
   * la nota que la pista acaba de cambiar (042).
   */
  const [chargingId, setChargingId] = useState<string | null>(null);
  const filterValues = useFilterValues(['bodyTypeId', 'serviceId', 'washerId', 'payment'] as const);

  // El día, la búsqueda y la página arrancan de la URL (056, 102): la ficha que
  // se abre desde una fila vuelve acá con todo puesto, sin pedir antes hoy.
  const searchParams = useSearchParams();
  const [initial] = useState(() =>
    ticketsListFrom({
      date: searchParams.get('date'),
      q: searchParams.get('q'),
      page: searchParams.get('page'),
    }),
  );
  const [selectedDate, setSelectedDateState] = useState<string>(() => initial.date ?? todayCivil());
  const [page, setPage] = useState(initial.page);
  const [term, setTerm] = useState(initial.search);
  const search = useDebouncedValue(term.trim());
  const searching = search !== '';

  // Cambiar de pestaña, día, búsqueda o filtro vuelve a la primera página (102).
  const setFilter = (next: FilterKey) => {
    setFilterState(next);
    setPage(1);
  };
  const setSelectedDate = (next: string) => {
    setSelectedDateState(next);
    setPage(1);
  };
  const extra = {
    values: filterValues.values,
    set: (key: Parameters<typeof filterValues.set>[0], value: string) => {
      filterValues.set(key, value);
      setPage(1);
    },
    reset: () => {
      filterValues.reset();
      setPage(1);
    },
  };
  const [lastSearch, setLastSearch] = useState(search);
  if (lastSearch !== search) {
    setLastSearch(search);
    setPage(1);
  }

  // Atrás/adelante dentro de la misma lista: se vuelve a leer lo que dice la barra.
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const next = ticketsListFrom({
        date: params.get('date'),
        q: params.get('q'),
        page: params.get('page'),
      });
      setSelectedDateState(next.date ?? todayCivil());
      setTerm(next.search);
      setPage(next.page);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    replaceQuery(ticketsListQuery({ date: selectedDate, search, page }));
  }, [selectedDate, search, page]);

  const status = useMemo(() => FILTERS.find((option) => option.key === filter)?.status, [filter]);
  // Los filtros los aplica el API (102): el total y la página dicen la verdad.
  // El resumen del día y las opciones de los filtros vienen en la misma respuesta.
  const tickets = useTickets({
    ...ticketFilterParams(filterValues.values),
    status,
    date: selectedDate,
    q: searching ? search : undefined,
    page,
    pageSize: LIST_PAGE_SIZE,
  });

  const canManage = can(PERMISSIONS.carwash.actions.manage.key);
  const canCharge = can(PERMISSIONS.carwash.actions.charge.key);

  const summary = useMemo(() => summarize(tickets.data?.summary), [tickets.data]);
  const moment = useMomentLabel();
  const counting = tickets.isPending;
  const money = centsParts(summary.paidCents);

  const isToday = selectedDate === todayCivil();
  const subtitleText = isToday ? (moment ?? '\u00a0') : dayLabel(selectedDate);
  const source = tickets.data?.items ?? EMPTY_TICKETS;
  const extraActive = countActiveFilters(Object.values(filterValues.values));
  const narrowing = searching || extraActive > 0;
  const facets = useMemo(() => ticketFacetOptions(tickets.data?.facets), [tickets.data]);
  const bodyOptions = withAllOption('Todas las carrocerías', facets.bodyTypes);
  const serviceOptions = withAllOption('Todos los servicios', facets.services);
  const washerOptions = withAllOption('Todos los empleados', facets.washers);

  /**
   * El del cobro, siempre fresco. Si desapareció de la lista —se cobró y el
   * filtro ya no lo trae— se conserva el último para que el diálogo no se
   * vacíe mientras se cierra.
   */
  const chargingTicket = useHeldWhileOpen(
    chargingId === null ? null : (source.find((row) => row.id === chargingId) ?? null),
    chargingId !== null && source.some((row) => row.id === chargingId),
  );

  const newTicketButton = canManage ? (
    <Button asChild>
      <Link href="/carwash/new">Nuevo lavado</Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Lavados"
        // El renglón se reserva aunque la hora todavía no esté: el título no
        // salta de sitio al hidratar.
        subtitle={
          <span>
            {subtitleText}
            {OFFICE_REFRESH_LABELS[refreshState(isLive, tickets.isFetching)]}
          </span>
        }
      >
        <DateField value={selectedDate} onChange={setSelectedDate} aria-label="Seleccionar fecha" />
        {/* El tablero (049) es la misma fila mirada de lejos: se entra desde
            acá y no desde el riel, porque no es otro módulo. */}
        <Button asChild variant="secondary">
          <Link href="/carwash/board">
            <Monitor aria-hidden strokeWidth={1.5} />
            Ver tablero
          </Link>
        </Button>
        {summary.all > 0 ? newTicketButton : null}
      </ScreenHeader>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="En espera"
          value={counting ? '—' : summary.queued}
          unit={counting ? undefined : summary.queued === 1 ? 'carro' : 'carros'}
          icon={<Car className="size-5" strokeWidth={1.75} aria-hidden />}
        />
        <StatCard
          label="Listos para cobrar"
          tone="go"
          value={counting ? '—' : summary.ready}
          unit={counting ? undefined : summary.ready === 1 ? 'carro' : 'carros'}
          icon={<CheckCircle2 className="size-5" strokeWidth={1.75} aria-hidden />}
        />
        <StatCard
          label="Cobrado hoy"
          value={counting ? '—' : money.whole}
          unit={counting ? undefined : money.fraction}
          icon={<CircleDollarSign className="size-5" strokeWidth={1.75} aria-hidden />}
        />
        <StatCard
          label="Avance del día"
          value={counting ? '—' : summary.paidCount}
          unit={counting ? undefined : `de ${summary.nonVoid}`}
        >
          <SegmentGauge value={summary.paidCount} max={summary.nonVoid} label="Cobrados" />
        </StatCard>
      </div>

      <FilterBar>
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="ticket-search">Buscar por placa, número o cliente</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="ticket-search"
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
            {
              id: 'service',
              label: 'Servicio',
              value: extra.values.serviceId,
              options: serviceOptions,
              onChange: (value) => extra.set('serviceId', value),
            },
            {
              id: 'washer',
              label: 'Empleado',
              value: extra.values.washerId,
              options: washerOptions,
              onChange: (value) => extra.set('washerId', value),
            },
            {
              id: 'payment',
              label: 'Pago',
              value: extra.values.payment,
              options: PAYMENT_OPTIONS,
              onChange: (value) => extra.set('payment', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      <Tabs
        aria-label="Filtro de lavados"
        value={filter}
        onValueChange={setFilter}
        items={FILTERS.map((option) => ({
          value: option.key,
          label: option.label,
          icon: option.icon,
          count: counting
            ? undefined
            : option.key === 'pending'
              ? summary.pending
              : option.key === 'ready'
                ? summary.ready
                : summary.all,
        }))}
      />

      <div id={`tabpanel-${filter}`} role="tabpanel" aria-labelledby={`tab-${filter}`}>
        <TicketsTable
          tickets={source}
          isLoading={tickets.isPending}
          errorMessage={tickets.error?.message ?? null}
          emptyTitle={narrowing ? 'Ningún lavado coincide' : EMPTY[filter].title}
          emptyMessage={
            searching
              ? `No hay placa, número ni cliente que coincida con «${search}».`
              : extraActive > 0
                ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
                : EMPTY[filter].message
          }
          emptyAction={narrowing || summary.all > 0 ? undefined : newTicketButton}
          canCharge={canCharge}
          onCharge={(ticket) => setChargingId(ticket.id)}
        />
      </div>

      <Pager page={tickets.data} noun={{ one: 'lavado', many: 'lavados' }} onPageChange={setPage} />

      {/* Un solo diálogo para toda la lista. El estado guarda el id y el ticket
          se relee de la lista: así el hilo en vivo también lo actualiza. */}
      {chargingId === null || chargingTicket === null ? null : (
        <ChargeDialog
          ticket={chargingTicket}
          open
          onOpenChange={(open) => {
            if (!open) setChargingId(null);
          }}
        />
      )}
    </div>
  );
}

function TicketsTable({
  tickets,
  isLoading,
  errorMessage,
  emptyTitle,
  emptyMessage,
  emptyAction,
  canCharge,
  onCharge,
}: {
  tickets: Ticket[];
  isLoading: boolean;
  errorMessage: string | null;
  emptyTitle: string;
  emptyMessage: string;
  emptyAction: ReactNode;
  canCharge: boolean;
  onCharge: (ticket: Ticket) => void;
}) {
  return (
    <DataTable
      rows={tickets}
      rowKey={(ticket) => ticket.id}
      rowHref={(ticket) => `/carwash/${ticket.id}`}
      // El lavado sí tiene folio propio: es el mismo número en la pista, en el
      // mostrador y en el papel que se le da al cliente (RN-15).
      reference={(ticket) => referenceOf(ticket.number)}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      emptyAction={emptyAction}
      columns={[
        {
          key: 'plate',
          header: 'Placa',
          stack: 'title',
          className: 'whitespace-nowrap',
          cell: (ticket) => (
            // La fila entera ya lleva el origen; la placa es un enlace propio
            // y `DataTable` no toca los clics sobre anclas, así que lo lleva
            // aparte o tocarla perdería la fecha y la búsqueda (spec 056).
            <OriginLink
              href={`/carwash/${ticket.id}`}
              className="inline-block rounded-control transition-transform duration-(--duration-state) hover:scale-[1.02]"
            >
              <PlateChip plate={ticket.vehicle.plate} />
            </OriginLink>
          ),
        },
        {
          key: 'customer',
          header: 'Responsable y servicio',
          headerClassName: 'w-full',
          cell: (ticket) => (
            <span className="block min-w-0">
              <b className="text-text block truncate font-semibold">{responsibleLabel(ticket)}</b>
              <span className="text-text-faint block truncate text-dense">
                {[ticket.items.map(itemLabel).join(' + '), ticket.bodyType.name]
                  .filter((part) => part !== '')
                  .join(' · ')}
              </span>
            </span>
          ),
        },
        {
          key: 'wait',
          header: 'Entrada',
          className: 'whitespace-nowrap',
          // La hora a la que entró el carro y cuánto estuvo adentro desde
          // entonces: el mismo número que la línea de tiempo (053).
          cell: (ticket) => {
            const elapsed = elapsedLabel(ticket, Date.now());

            return (
              <span className="text-text-dim tabular-nums">
                {timeOf(ticket.createdAt)}
                {elapsed === null ? '' : ` · ${elapsed}`}
              </span>
            );
          },
        },
        {
          key: 'washer',
          header: 'Empleado',
          className: 'whitespace-nowrap',
          cell: (ticket) => <span className="text-text-dim truncate">{washersLabel(ticket)}</span>,
        },
        {
          key: 'status',
          header: 'Estado',
          stack: 'aside',
          className: 'whitespace-nowrap',
          cell: (ticket) => <TicketStatusStamp status={ticket.status} />,
        },
        {
          key: 'total',
          header: 'Total',
          align: 'right',
          className: 'whitespace-nowrap',
          cell: (ticket) => (
            <span className="text-text font-mono font-semibold">${ticket.total}</span>
          ),
        },
        {
          key: 'actions',
          header: 'Acciones',
          stack: 'actions',
          className: 'whitespace-nowrap',
          cell: (ticket) => (
            <RowActions ticket={ticket} canCharge={canCharge} onCharge={onCharge} />
          ),
        },
      ]}
    />
  );
}

/**
 * Los verbos de una fila.
 *
 * Cada fila lleva exactamente una acción en la columna «Acciones» cuando
 * corresponde una acción operativa directa: Cobrar (en READY con permiso).
 * El estado se cambia desde el detalle, con aviso (037).
 *
 * El detalle del lavado se abre tocando la placa o la fila/tarjeta entera (`rowHref`).
 * Si la fila no requiere acción operativa directa, no se renderiza ningún botón pasivo
 * redundante («Abrir», «Ver», «Ver recibo»).
 */
function RowActions({
  ticket,
  canCharge,
  onCharge,
}: {
  ticket: Ticket;
  canCharge: boolean;
  onCharge: (ticket: Ticket) => void;
}) {
  if (ticket.status === 'READY' && canCharge) {
    return (
      <Button type="button" variant="outline" onClick={() => onCharge(ticket)}>
        Cobrar
        <span className="sr-only"> el lavado {ticket.number}</span>
      </Button>
    );
  }

  return null;
}
