'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Ticket } from '@elite/shared';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, CheckCircle2, Clock, List, Search } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { SegmentGauge } from '@/components/ui/segment-gauge';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTicketAction, useTickets } from '../hooks/use-tickets';
import { readyUndoToast } from '../ready-undo';
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

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const SHORT_DAY_FORMAT = new Intl.DateTimeFormat('es-SV', {
  day: 'numeric',
  month: 'short',
});

function formatDayButton(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const obj = new Date(y, m - 1, d);

  return SHORT_DAY_FORMAT.format(obj);
}

function daySubtitle(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  const text = DAY_FORMAT.format(dateObj).replace(',', '');

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function DaySelector({
  date,
  onChange,
}: {
  date: string;
  onChange: (date: string) => void;
}) {
  const today = localToday();
  const isToday = date === today;
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative inline-flex items-center">
        <Button
          type="button"
          variant="outline"
          className="relative gap-2"
          onClick={() => {
            try {
              inputRef.current?.showPicker();
            } catch {
              inputRef.current?.focus();
            }
          }}
        >
          <Calendar className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <span>{isToday ? 'Hoy' : formatDayButton(date)}</span>
        </Button>
        <input
          ref={inputRef}
          type="date"
          aria-label="Seleccionar fecha"
          value={date}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="sr-only"
        />
      </div>
      {!isToday ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(today)}
        >
          Hoy
        </Button>
      ) : null}
    </div>
  );
}

/**
 * La fila de lavados de **oficina**.
 *
 * Arriba, el día de un vistazo: cuántos hay en cola, cuántos esperan cobro,
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

  const [selectedDate, setSelectedDate] = useState<string>(localToday);
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
      setSelectedDate(p.get('date') || localToday());
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

  const isToday = selectedDate === localToday();
  const subtitleText = isToday ? (moment ?? '\u00a0') : daySubtitle(selectedDate);

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
        <DaySelector date={selectedDate} onChange={setSelectedDate} />
        {(day.data?.length ?? 0) > 0 ? newTicketButton : null}
      </ScreenHeader>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="En cola"
          value={counting ? '—' : summary.queued}
          unit={counting ? undefined : summary.queued === 1 ? 'carro' : 'carros'}
        />
        <StatCard label="Listos para cobrar" tone="go" value={counting ? '—' : summary.ready} />
        <StatCard
          label="Cobrado hoy"
          value={counting ? '—' : money.whole}
          unit={counting ? undefined : money.fraction}
        />
        <StatCard
          label="Avance del día"
          value={counting ? '—' : summary.paidCount}
          unit={counting ? undefined : `de ${summary.nonVoid}`}
        >
          <SegmentGauge value={summary.paidCount} max={summary.nonVoid} label="Cobrados" />
        </StatCard>
      </div>

      <div className="max-w-md">
        <FieldBox>
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
          tickets={tickets.data ?? []}
          isLoading={tickets.isPending}
          errorMessage={tickets.error?.message ?? null}
          emptyTitle={searching ? 'Ningún lavado coincide' : EMPTY[filter].title}
          emptyMessage={
            searching
              ? `No hay placa, número ni cliente que coincida con «${search}».`
              : EMPTY[filter].message
          }
          emptyAction={searching ? undefined : newTicketButton}
          canManage={canManage}
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
  canManage,
  canCharge,
  onCharge,
}: {
  tickets: Ticket[];
  isLoading: boolean;
  errorMessage: string | null;
  emptyTitle: string;
  emptyMessage: string;
  emptyAction: ReactNode;
  canManage: boolean;
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
          header: 'Lavador',
          className: 'whitespace-nowrap',
          cell: (ticket) => (
            <span className="text-text-dim truncate">{washersLabel(ticket)}</span>
          ),
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
            <RowActions
              ticket={ticket}
              canManage={canManage}
              canCharge={canCharge}
              onCharge={onCharge}
            />
          ),
        },
      ]}
    />
  );
}

/**
 * Los verbos de una fila.
 *
 * Cada fila lleva exactamente una acción en la columna «Acciones» con variante
 * outline y alto estándar: Cobrar (en READY), Marcar listo (en OPEN), Ver recibo
 * (en PAID), Ver (en VOID) o Abrir si no hay permisos para accionar.
 *
 * El detalle del lavado se abre tocando la placa o la fila entera (`rowHref`).
 * Así se preserva la regla de un solo botón primario con degradado por pantalla
 * y todas las filas conservan la misma altura estandarizada.
 */
function RowActions({
  ticket,
  canManage,
  canCharge,
  onCharge,
}: {
  ticket: Ticket;
  canManage: boolean;
  canCharge: boolean;
  onCharge: (ticket: Ticket) => void;
}) {
  const ready = useTicketAction('ready');
  const reopen = useTicketAction('reopen');
  const { toast } = useToast();
  const sequence = referenceOf(ticket.number);
  const href = `/carwash/${ticket.id}`;

  if (ticket.status === 'PAID') {
    return (
      <Button asChild variant="outline">
        <Link href={href}>
          <ArrowRight className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
          Ver recibo
          <span className="sr-only"> del lavado {ticket.number}</span>
        </Link>
      </Button>
    );
  }

  if (ticket.status === 'VOID') {
    return (
      <Button asChild variant="outline">
        <Link href={href}>
          <ArrowRight className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
          Ver
          <span className="sr-only"> del lavado {ticket.number}</span>
        </Link>
      </Button>
    );
  }

  if (ticket.status === 'READY' && canCharge) {
    return (
      <Button type="button" variant="outline" onClick={() => onCharge(ticket)}>
        Cobrar
        <span className="sr-only"> el lavado {ticket.number}</span>
      </Button>
    );
  }

  if (ticket.status === 'OPEN' && canManage) {
    return (
      <div className="flex flex-col items-end">
        <Button
          type="button"
          variant="outline"
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
          <span className="sr-only"> el lavado {ticket.number}</span>
        </Button>
        {ready.error ? (
          <p role="alert" className="text-danger-text w-full text-right text-label">
            {ready.error.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Button asChild variant="outline">
      <Link href={href}>
        <ArrowRight className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
        Abrir
        <span className="sr-only"> el lavado {ticket.number}</span>
      </Link>
    </Button>
  );
}
