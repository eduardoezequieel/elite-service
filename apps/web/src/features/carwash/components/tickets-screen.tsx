'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Ticket } from '@elite/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import {
  Car,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  List,
  Search,
} from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { SegmentGauge } from '@/components/ui/segment-gauge';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { todayCivil } from '@/lib/civil-date';
import {
  countActiveFilters,
  ticketBodyTypeOptions,
  ticketMatchesFilters,
  ticketServiceOptions,
  ticketWasherOptions,
  withAllOption,
  PENDING_FILTER,
} from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { METHOD_LABELS } from '../cash-format';
import { useTickets } from '../hooks/use-tickets';
import { referenceOf } from '../reference';
import { timeOf, waitLabel } from '../wait';
import { washersLabel } from '../washers';
import { ChargeDialog } from './charge-dialog';
import { TicketStatusStamp } from './ticket-status-stamp';

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

/**
 * El dinero viaja como cadena decimal (`"14.00"`) justamente para no pasar por
 * un `number`. Para sumarlo en pantalla se parte en centavos enteros y se suma
 * ahí: dos líneas de `0.1` no pueden dar `0.30000000000000004`.
 */
function centsOf(amount: string): number {
  const [whole = '0', fraction = ''] = amount.split('.');
  const cents = `${fraction}00`.slice(0, 2);

  return (Number(whole) || 0) * 100 + (Number(cents) || 0);
}

/** Los centavos de vuelta a `148` y `.00`, que la cifra dibuja en dos tamaños. */
function moneyParts(cents: number): { whole: string; fraction: string } {
  return {
    whole: `$${Math.trunc(cents / 100)}`,
    fraction: `.${String(cents % 100).padStart(2, '0')}`,
  };
}

const DAY_FORMAT = new Intl.DateTimeFormat('es-SV', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const TIME_FORMAT = new Intl.DateTimeFormat('es-SV', { hour: 'numeric', minute: '2-digit' });

/** «Martes 2 de septiembre, 9:42 a.m.» */
function momentLabel(date: Date): string {
  const day = DAY_FORMAT.format(date).replace(',', '');
  // Según la versión de ICU, «a. m.» viene con espacio fino o duro: se
  // normaliza antes de compactarlo.
  const time = TIME_FORMAT.format(date)
    .replaceAll(/[\u202f\u00a0]/gu, ' ')
    .replace('a. m.', 'a.m.')
    .replace('p. m.', 'p.m.');
  const text = `${day}, ${time}`;

  return text.charAt(0).toUpperCase() + text.slice(1);
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

/** Lo que el mostrador quiere saber del día, derivado de la consulta «Todos». */
interface DaySummary {
  queued: number;
  ready: number;
  paidCents: number;
  paidCount: number;
  nonVoid: number;
  pending: number;
  all: number;
}

function summarize(tickets: readonly Ticket[]): DaySummary {
  let queued = 0;
  let ready = 0;
  let paidCents = 0;
  let paidCount = 0;
  let nonVoid = 0;

  for (const ticket of tickets) {
    if (ticket.status !== 'VOID') nonVoid += 1;
    if (ticket.status === 'OPEN' || ticket.status === 'WASHING') queued += 1;
    if (ticket.status === 'READY') ready += 1;
    if (ticket.status === 'PAID') {
      paidCount += 1;
      paidCents += centsOf(ticket.total);
    }
  }

  return {
    queued,
    ready,
    paidCents,
    paidCount,
    nonVoid,
    pending: queued + ready,
    all: tickets.length,
  };
}

function daySubtitle(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  const text = DAY_FORMAT.format(dateObj).replace(',', '');

  return text.charAt(0).toUpperCase() + text.slice(1);
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
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [chargingTicket, setChargingTicket] = useState<Ticket | null>(null);
  const extra = useFilterValues(['bodyTypeId', 'serviceId', 'washerId', 'payment'] as const);

  const [selectedDate, setSelectedDate] = useState<string>(todayCivil);
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const searching = search !== '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDate = params.get('date');
    const urlQ = params.get('q');
    if (urlDate) setSelectedDate(urlDate);
    if (urlQ) setTerm(urlQ);

    const onPopState = () => {
      const p = new URLSearchParams(window.location.search);
      setSelectedDate(p.get('date') || todayCivil());
      setTerm(p.get('q') || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedDate) {
      params.set('date', selectedDate);
    } else {
      params.delete('date');
    }
    if (searching) {
      params.set('q', search);
    } else {
      params.delete('q');
    }
    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [selectedDate, search, searching]);

  const status = useMemo(() => FILTERS.find((option) => option.key === filter)?.status, [filter]);
  const tickets = useTickets({
    status,
    date: selectedDate,
    q: searching ? search : undefined,
  });
  // «Todos» es la base de las estadísticas y de los contadores: una sola
  // consulta más, y la misma que sirve la pestaña «Todos».
  const day = useTickets({ status: undefined, date: selectedDate });

  const canManage = can(PERMISSIONS.carwash.actions.manage.key);
  const canCharge = can(PERMISSIONS.carwash.actions.charge.key);

  const summary = useMemo(() => summarize(day.data ?? []), [day.data]);
  const moment = useMomentLabel();
  const counting = day.isPending;
  const money = moneyParts(summary.paidCents);

  const isToday = selectedDate === todayCivil();
  const subtitleText = isToday ? (moment ?? '\u00a0') : daySubtitle(selectedDate);
  const source = tickets.data ?? EMPTY_TICKETS;
  const extraActive = countActiveFilters(Object.values(extra.values));
  const narrowing = searching || extraActive > 0;
  const visibleTickets = useMemo(
    () => source.filter((row) => ticketMatchesFilters(row, extra.values)),
    [extra.values, source],
  );
  const bodyOptions = useMemo(
    () => withAllOption('Todas las carrocerías', ticketBodyTypeOptions(source)),
    [source],
  );
  const serviceOptions = useMemo(
    () => withAllOption('Todos los servicios', ticketServiceOptions(source)),
    [source],
  );
  const washerOptions = useMemo(
    () => withAllOption('Todos los empleados', ticketWasherOptions(source)),
    [source],
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
            {tickets.isFetching ? ' · actualizando' : ' · se actualiza sola'}
          </span>
        }
      >
        <DateField value={selectedDate} onChange={setSelectedDate} aria-label="Seleccionar fecha" />
        {(day.data?.length ?? 0) > 0 ? newTicketButton : null}
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
              <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
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
          tickets={visibleTickets}
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
          emptyAction={narrowing || (day.data?.length ?? 0) > 0 ? undefined : newTicketButton}
          canCharge={canCharge}
          onCharge={setChargingTicket}
        />
      </div>

      {/* Un solo diálogo para toda la lista: el que se abre sabe de qué lavado
          es porque el estado guarda el ticket, no un `id` suelto. */}
      {chargingTicket === null ? null : (
        <ChargeDialog
          ticket={chargingTicket}
          open
          onOpenChange={(open) => {
            if (!open) setChargingTicket(null);
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
            <Link
              href={`/carwash/${ticket.id}`}
              className="inline-block rounded-control transition-transform duration-(--duration-state) hover:scale-[1.02]"
            >
              <PlateChip plate={ticket.vehicle.plate} />
            </Link>
          ),
        },
        {
          key: 'customer',
          header: 'Cliente y servicio',
          headerClassName: 'w-full',
          cell: (ticket) => (
            <span className="block min-w-0">
              <b className="text-text block truncate font-semibold">{ticket.customer.fullName}</b>
              <span className="text-text-faint block truncate text-dense">
                {[ticket.items.map((item) => item.serviceName).join(' + '), ticket.bodyType.name]
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
          cell: (ticket) => (
            <span className="text-text-dim">
              {timeOf(ticket.createdAt)} · {waitLabel(ticket.washingStartedAt ?? ticket.createdAt)}
            </span>
          ),
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
