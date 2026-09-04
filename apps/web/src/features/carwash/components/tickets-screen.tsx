'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Ticket } from '@elite/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Clock, List } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { PlateChip } from '@/components/ui/plate-chip';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { SegmentGauge } from '@/components/ui/segment-gauge';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useTicketAction, useTickets } from '../hooks/use-tickets';
import { referenceOf } from '../reference';
import { ChargeDialog } from './charge-dialog';
import { TicketStatusStamp } from './ticket-status-stamp';

/** Los filtros de la fila. «Pendientes» es lo que el mostrador mira todo el día. */
const FILTERS = [
  { key: 'pending', label: 'Pendientes', status: 'OPEN,READY', icon: Clock },
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
    if (ticket.status === 'OPEN') queued += 1;
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

  const status = useMemo(() => FILTERS.find((option) => option.key === filter)?.status, [filter]);
  const tickets = useTickets({ status });
  // «Todos» es la base de las estadísticas y de los contadores: una sola
  // consulta más, y la misma que sirve la pestaña «Todos».
  const day = useTickets({ status: undefined });

  const canManage = can(PERMISSIONS.carwash.actions.manage.key);
  const canCharge = can(PERMISSIONS.carwash.actions.charge.key);

  const summary = useMemo(() => summarize(day.data ?? []), [day.data]);
  const moment = useMomentLabel();
  const counting = day.isPending;
  const money = moneyParts(summary.paidCents);

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
        subtitle={<span>{moment ?? '\u00a0'}</span>}
      >
        {newTicketButton}
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
          emptyTitle={EMPTY[filter].title}
          emptyMessage={EMPTY[filter].message}
          emptyAction={newTicketButton}
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
              className="inline-block transition-transform duration-(--duration-state) hover:scale-[1.02] focus-visible:outline-none"
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
          key: 'washer',
          header: 'Lavador',
          className: 'whitespace-nowrap',
          // Sin lavador el ticket se abrió desde el mostrador (RN-8).
          cell: (ticket) => (
            <span className="text-text-dim truncate">{ticket.washer?.fullName ?? 'Oficina'}</span>
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
  const { toast } = useToast();
  const sequence = referenceOf(ticket.number);
  const href = `/carwash/${ticket.id}`;

  if (ticket.status === 'PAID') {
    return (
      <Button asChild variant="outline" size="sm">
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
      <Button asChild variant="outline" size="sm">
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onCharge(ticket)}
      >
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
          size="sm"
          loading={ready.isPending}
          onClick={() =>
            ready.mutate(ticket.id, {
              onSuccess: () => toast({ title: `Lavado #${sequence} marcado listo` }),
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
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <ArrowRight className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
        Abrir
        <span className="sr-only"> el lavado {ticket.number}</span>
      </Link>
    </Button>
  );
}
