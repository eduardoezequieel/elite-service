'use client';

import type { Ticket, WorkOrderStatus } from '@elite/shared';
import { CircleDashed, Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { GaugeLoader } from '@/components/ui/gauge-loader';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { dayLabel, todayCivil } from '@/lib/civil-date';
import { cn } from '@/lib/utils';
import {
  averageLabel,
  buildBoard,
  elapsedClock,
  laneWasherOf,
  type BoardWasher,
  type BoardWashing,
} from '../board';
import { secondsSince } from '../duration';
import { useCarwashLive } from '../hooks/use-carwash-live';
import { useTickets } from '../hooks/use-tickets';
import { OFFICE_REFRESH_LABELS, refreshState } from '../live-label';
import { itemLabel } from '../product-lines';
import { timeOf, waitLabel } from '../wait';
import { givenName } from '../washers';
import { TicketStatusStamp } from './ticket-status-stamp';

/** Pasados tres cuartos de hora el carro lleva demasiado encima: el número avisa. */
const LONG_WASH_SECONDS = 45 * 60;

/** Y media hora esperando en la cola también se avisa. */
const LONG_WAIT_SECONDS = 30 * 60;

/**
 * El reloj del tablero.
 *
 * Empieza en cero y solo se pone en hora después de montar: pintar la hora en
 * el servidor daría la del servidor y rompería la hidratación. Late cada
 * segundo porque el cronómetro del carro en curso cuenta segundos, y no dispara
 * ninguna consulta: los datos los trae el hilo de la 042.
 */
function useNow(): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());

    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);

    return () => globalThis.clearInterval(timer);
  }, []);

  return now;
}

/** Pantalla completa de verdad, sobre el documento entero. */
function useFullscreen(): { supported: boolean; active: boolean; toggle: () => void } {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Si el navegador no la tiene, el botón no se dibuja: un botón que no hace
    // nada es peor que no tenerlo.
    setSupported(typeof document.documentElement.requestFullscreen === 'function');

    const sync = () => setActive(document.fullscreenElement !== null);

    sync();
    document.addEventListener('fullscreenchange', sync);

    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement === null) {
      // El usuario puede negarla; que falle no rompe la pantalla.
      void document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  return { supported, active, toggle };
}

/** «Toyota · Sedán»: lo que se grita en la pista además de la placa. */
function vehicleLabel(ticket: Ticket): string {
  return [ticket.vehicle.make, ticket.bodyType.name].filter((part) => Boolean(part)).join(' · ');
}

function servicesLabel(ticket: Ticket): string {
  return ticket.items.map(itemLabel).join(' + ');
}

/** El nombre corto de quien lo lava, o que todavía nadie lo tomó. */
function washerLabel(ticket: Ticket): string {
  const washer = laneWasherOf(ticket);

  return washer === null ? 'Sin asignar' : givenName(washer.fullName);
}

/**
 * El tablero de pista (spec 049, kanban desde la 089).
 *
 * Es una pantalla para **mirar**, no para operar: tres columnas por estado —en
 * cola, lavando, listos para cobrar— para saber de un vistazo qué espera, qué
 * está en la bahía y qué ya salió, y abajo una franja por lavador con lo que
 * sacó hoy. Acá no hay un solo botón que mueva un lavado —eso es de `/carwash`
 * y de `/floor`—; lo único que se toca es la pantalla completa.
 *
 * Lo cobrado no se dibuja y el dinero no vive acá (089): lo que ya pagó se fue
 * de la pista.
 */
export function BoardScreen() {
  const { isLive } = useCarwashLive();
  const now = useNow();
  const fullscreen = useFullscreen();

  const tickets = useTickets({ date: todayCivil() });
  const board = useMemo(() => buildBoard(tickets.data ?? [], now), [tickets.data, now]);
  const mounted = now !== 0;
  const empty =
    board.washers.length === 0 &&
    board.totals.open + board.totals.washing + board.totals.ready === 0;

  return (
    <div className="board-screen bg-bg flex min-h-screen flex-col gap-[calc(18px*var(--board-scale))] px-4 py-[calc(18px*var(--board-scale))] md:px-[calc(22px*var(--board-scale))]">
      <ScreenHeader
        title="Pista"
        // El renglón se reserva aunque la fecha todavía no esté: el título no
        // salta de sitio al hidratar.
        subtitle={
          <span>
            {mounted ? dayLabel(new Date(now).toISOString()) : ' '}
            {OFFICE_REFRESH_LABELS[refreshState(isLive, tickets.isFetching)]}
          </span>
        }
        className="mb-0"
      >
        {/* En la tablet el reloj sobra: lo tiene el sistema operativo arriba. */}
        <span className="text-text board-figure hidden font-display font-bold italic tabular-nums md:inline">
          {mounted ? timeOf(new Date(now).toISOString()) : ' '}
        </span>
        {fullscreen.supported ? (
          <Button type="button" variant="secondary" onClick={fullscreen.toggle}>
            {fullscreen.active ? (
              <Minimize2 aria-hidden strokeWidth={1.5} />
            ) : (
              <Maximize2 aria-hidden strokeWidth={1.5} />
            )}
            {fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </Button>
        ) : null}
      </ScreenHeader>

      {tickets.isPending ? (
        <GaugeLoader label="Cargando el tablero" className="self-center py-10" />
      ) : tickets.error !== null ? (
        <p className="text-danger-text board-body" role="alert">
          {tickets.error.message}
        </p>
      ) : empty ? (
        <EmptyState
          title="Todavía nadie tomó un carro"
          description="Cuando entre el primero va a aparecer acá, en su columna."
        />
      ) : (
        <>
          {/* Bajo 900px las columnas pasan a un carril horizontal con imán: una
              por pantalla, que es como se mira de pie con la tablet. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-[calc(14px*var(--board-scale))] overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-x-visible md:px-0 md:pb-0">
            <BoardColumn
              status="OPEN"
              title="En cola"
              count={board.totals.open}
              empty="Nadie en espera"
            >
              {board.queued.map((ticket) => (
                <QueuedCard key={ticket.id} ticket={ticket} now={now} />
              ))}
            </BoardColumn>
            <BoardColumn
              status="WASHING"
              title="Lavando"
              count={board.totals.washing}
              empty="Nadie lavando"
              className={board.totals.washing > 0 ? 'border-flame/40' : undefined}
            >
              {board.washing.map((row) => (
                <WashingCard key={row.ticket.id} row={row} />
              ))}
            </BoardColumn>
            <BoardColumn
              status="READY"
              title="Listos para cobrar"
              count={board.totals.ready}
              empty="Nada por cobrar"
              className={board.totals.ready > 0 ? 'border-go/40' : undefined}
            >
              {board.ready.map((ticket) => (
                <ReadyCard key={ticket.id} ticket={ticket} />
              ))}
            </BoardColumn>
          </div>

          {board.washers.length === 0 ? null : <WashersStrip washers={board.washers} />}
        </>
      )}
    </div>
  );
}

/**
 * Una columna del kanban.
 *
 * El filete se tiñe cuando hay algo adentro, pero la palabra del chip y el
 * título son lo que dicen el estado: el color solo acompaña.
 */
function BoardColumn({
  status,
  title,
  count,
  empty,
  className,
  children,
}: {
  status: WorkOrderStatus;
  title: string;
  count: number;
  empty: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      aria-label={`${title}: ${count}`}
      className={cn(
        'w-[min(88vw,380px)] shrink-0 snap-start gap-[calc(12px*var(--board-scale))] px-[calc(16px*var(--board-scale))] py-[calc(16px*var(--board-scale))] md:w-auto',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <TicketStatusStamp status={status} />
          <h2 className="text-text board-headline m-0 min-w-0 truncate font-semibold">{title}</h2>
        </div>
        <span className="text-text board-timer font-display font-bold italic tabular-nums">
          {count}
        </span>
      </div>

      {count === 0 ? (
        <p className="border-line text-text-faint board-body m-0 flex min-h-[calc(96px*var(--board-scale))] items-center justify-center rounded-row border border-dashed">
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-[calc(8px*var(--board-scale))]">{children}</div>
      )}
    </Card>
  );
}

/** Un carro que espera: placa, quién lo va a lavar y cuánto lleva esperando. */
function QueuedCard({ ticket, now }: { ticket: Ticket; now: number }) {
  const long = secondsSince(ticket.createdAt, now) > LONG_WAIT_SECONDS;
  const unassigned = laneWasherOf(ticket) === null;

  return (
    <div className="border-line-soft bg-surface-2 flex min-h-(--row-h) flex-col gap-1.5 rounded-row border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <PlateChip plate={ticket.vehicle.plate} />
        <span
          className={cn(
            'board-dense whitespace-nowrap tabular-nums',
            long ? 'text-warn-text' : 'text-text-faint',
          )}
        >
          espera {waitLabel(ticket.createdAt)}
        </span>
      </div>
      <div className="board-dense flex min-w-0 items-baseline justify-between gap-2.5">
        <span className="text-text-dim min-w-0 truncate">{vehicleLabel(ticket)}</span>
        <span
          className={cn(
            'whitespace-nowrap font-semibold',
            unassigned ? 'text-warn-text' : 'text-text',
          )}
        >
          {washerLabel(ticket)}
        </span>
      </div>
    </div>
  );
}

/** El carro en la bahía, con el cronómetro grande. */
function WashingCard({ row }: { row: BoardWashing }) {
  const services = servicesLabel(row.ticket);
  const long = row.elapsedSeconds > LONG_WASH_SECONDS;

  return (
    <div className="border-line-soft bg-surface-2 flex flex-col gap-2 rounded-row border p-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <PlateChip plate={row.ticket.vehicle.plate} size="lg" />
        <span className="text-text board-body whitespace-nowrap font-semibold">
          {washerLabel(row.ticket)}
        </span>
      </div>
      <p className="text-text board-body m-0 font-semibold">{vehicleLabel(row.ticket)}</p>
      {services === '' ? null : <p className="text-text-dim board-dense m-0">{services}</p>}
      <div className="mt-1 flex items-baseline justify-between gap-2.5">
        <span
          className={cn(
            'board-timer font-display font-bold italic tabular-nums',
            long ? 'text-warn-text' : 'text-flame-text',
          )}
        >
          {elapsedClock(row.elapsedSeconds)}
        </span>
        {row.startedAt === null ? null : (
          <span className="text-text-faint board-dense whitespace-nowrap">
            desde {timeOf(row.startedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Un carro listo que espera en el mostrador. */
function ReadyCard({ ticket }: { ticket: Ticket }) {
  const washer = laneWasherOf(ticket);

  return (
    <div className="border-line-soft bg-surface-2 flex min-h-(--row-h) flex-col gap-1.5 rounded-row border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <PlateChip plate={ticket.vehicle.plate} />
        <span className="text-text-faint board-dense whitespace-nowrap tabular-nums">
          listo hace {waitLabel(ticket.readyAt ?? ticket.createdAt)}
        </span>
      </div>
      <div className="board-dense flex min-w-0 items-baseline justify-between gap-2.5">
        <span className="text-text-dim min-w-0 truncate">{vehicleLabel(ticket)}</span>
        <span className="text-text whitespace-nowrap font-semibold">
          {washer === null ? 'Oficina' : givenName(washer.fullName)}
        </span>
      </div>
    </div>
  );
}

/** La franja de abajo: cuántos sacó cada uno hoy, su promedio y si está libre. */
function WashersStrip({ washers }: { washers: readonly BoardWasher[] }) {
  return (
    <section aria-label="Lavadores hoy" className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <b className="text-text board-headline font-semibold">Lavadores hoy</b>
        <span className="text-text-faint text-label">terminados y promedio</span>
      </div>

      <div className="flex flex-col gap-[calc(10px*var(--board-scale))] md:flex-row md:flex-wrap">
        {washers.map((row) => (
          <div
            key={row.washer.id}
            className="border-line-soft bg-surface flex min-h-(--row-h) items-center gap-3.5 rounded-row border px-3.5 py-2.5 md:min-w-[calc(240px*var(--board-scale))] md:flex-1"
          >
            <span className="text-text board-figure font-display font-bold italic tabular-nums">
              {row.doneToday}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-text board-body truncate font-semibold">
                {row.washer.fullName}
              </span>
              <span className="text-text-dim board-dense">{averageLabel(row.averageSeconds)}</span>
            </div>
            {row.busy ? (
              <TicketStatusStamp status="WASHING" />
            ) : (
              // «Libre» no es un estado del lavado, pero comparte fila con uno: va
              // con icono para que los dos chips se lean igual (053).
              <Stamp tone="neutral" label="Libre" icon={<CircleDashed />} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
