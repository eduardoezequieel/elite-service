'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Ticket } from '@elite/shared';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { todayCivil } from '@/lib/civil-date';
import { cn } from '@/lib/utils';
import {
  averageLabel,
  buildBoard,
  elapsedClock,
  laneWasherOf,
  type BoardCurrent,
  type BoardLane,
} from '../board';
import { centsParts } from '../cash-format';
import { secondsSince } from '../duration';
import { useCarwashLive } from '../hooks/use-carwash-live';
import { useTickets } from '../hooks/use-tickets';
import { OFFICE_REFRESH_LABELS, refreshState } from '../live-label';
import { timeOf, waitLabel } from '../wait';
import { givenName } from '../washers';

/** Pasados tres cuartos de hora el carro lleva demasiado encima: el número avisa. */
const LONG_WASH_SECONDS = 45 * 60;

/** Y media hora esperando en la cola de alguien también se avisa. */
const LONG_WAIT_SECONDS = 30 * 60;

const DAY_FORMAT = new Intl.DateTimeFormat('es-SV', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** «Domingo 20 de septiembre». */
function dayLabel(date: Date): string {
  const text = DAY_FORMAT.format(date).replace(',', '');

  return text.charAt(0).toUpperCase() + text.slice(1);
}

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
  return ticket.items.map((item) => item.serviceName).join(' + ');
}

/**
 * El tablero de pista (spec 049).
 *
 * Es una pantalla para **mirar**, no para operar: una columna por lavador con
 * el carro que tiene encima y su cronómetro, lo que le espera, lo que quedó
 * listo para cobrar y cuántos terminó cada uno hoy. Acá no hay un solo botón
 * que mueva un lavado —eso es de `/carwash` y de `/floor`—; lo único que se
 * toca es la pantalla completa.
 *
 * Vive en dos sitios con el mismo código: la TV de la pista, con un usuario que
 * solo tiene `carwash.read`, y el monitor del dueño, que con `carwash.cash` ve
 * además lo cobrado del día. Sin ese permiso el dinero **no se renderiza**: no
 * se esconde con CSS.
 */
export function BoardScreen() {
  const { can } = usePermissions();
  const { isLive } = useCarwashLive();
  const now = useNow();
  const fullscreen = useFullscreen();

  const tickets = useTickets({ date: todayCivil() });
  const board = useMemo(() => buildBoard(tickets.data ?? [], now), [tickets.data, now]);
  const canSeeMoney = can(PERMISSIONS.carwash.actions.cash.key);
  const money = centsParts(board.totals.paidCents);
  const mounted = now !== 0;

  return (
    <div className="board-screen bg-bg flex min-h-screen flex-col gap-[calc(18px*var(--board-scale))] px-4 py-[calc(18px*var(--board-scale))] md:px-[calc(22px*var(--board-scale))]">
      <ScreenHeader
        title="Pista"
        // El renglón se reserva aunque la fecha todavía no esté: el título no
        // salta de sitio al hidratar.
        subtitle={
          <span>
            {mounted ? dayLabel(new Date(now)) : ' '}
            {OFFICE_REFRESH_LABELS[refreshState(isLive, tickets.isFetching)]}
          </span>
        }
        className="mb-0"
      >
        {/* En la tablet el reloj sobra: lo tiene el sistema operativo arriba. */}
        <span className="text-text board-figure hidden font-display font-bold italic tabular-nums md:inline">
          {mounted ? timeOf(new Date(now).toISOString()) : ' '}
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

      <div className="flex flex-wrap gap-3.5">
        <StatCard
          className="min-w-[150px] flex-1"
          label="En cola"
          value={tickets.isPending ? '—' : board.totals.open}
        />
        <StatCard
          className="min-w-[150px] flex-1"
          label="Lavando"
          tone="flame"
          value={tickets.isPending ? '—' : board.totals.washing}
        />
        <StatCard
          className="min-w-[150px] flex-1"
          label="Listos"
          tone="go"
          value={tickets.isPending ? '—' : board.totals.ready}
        />
        {/* Sin `carwash.cash` este nodo no existe: no está oculto, no está. */}
        {canSeeMoney ? (
          <StatCard
            className="min-w-[150px] flex-1"
            label="Cobrado hoy"
            tone="go"
            value={tickets.isPending ? '—' : money.whole}
            unit={tickets.isPending ? undefined : money.fraction}
          />
        ) : null}
      </div>

      {tickets.isPending ? (
        <p className="text-text-dim board-body">Cargando…</p>
      ) : tickets.error !== null ? (
        <p className="text-danger-text board-body" role="alert">
          {tickets.error.message}
        </p>
      ) : board.washers.length === 0 ? (
        <EmptyState
          title="Todavía nadie tomó un carro"
          description="Cuando un lavador tome uno va a aparecer acá, con su cronómetro."
        />
      ) : (
        <>
          {/* Bajo 900px las columnas pasan a un carril horizontal con imán: una
              por pantalla, que es como se mira de pie con la tablet. */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-[calc(14px*var(--board-scale))] overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] md:mx-0 md:grid md:snap-none md:auto-cols-[minmax(calc(250px*var(--board-scale)),1fr)] md:grid-flow-col md:overflow-x-visible md:px-0 md:pb-0">
            {board.washers.map((lane) => (
              <LaneColumn key={lane.washer.id} lane={lane} now={now} />
            ))}
          </div>

          <ReadyStrip ready={board.ready} />
          <DoneToday washers={board.washers} />
        </>
      )}
    </div>
  );
}

/** La columna de un lavador: lo que tiene encima y lo que le espera. */
function LaneColumn({ lane, now }: { lane: BoardLane; now: number }) {
  return (
    <Card
      className={cn(
        'w-[min(88vw,360px)] shrink-0 snap-start gap-[calc(12px*var(--board-scale))] px-card md:w-auto',
        // El filete se tiñe cuando hay un carro adentro, pero la palabra del
        // chip es lo que lo dice: el color solo acompaña.
        lane.current !== null && 'border-flame/40',
      )}
    >
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="text-text board-headline min-w-0 truncate font-semibold">
          {lane.washer.fullName}
        </h2>
        {lane.current === null ? (
          <Stamp tone="neutral" label="Libre" />
        ) : (
          <Stamp tone="washing" label="Lavando" />
        )}
      </div>

      {lane.current === null ? (
        <p className="border-line text-text-faint board-body m-0 flex min-h-[calc(120px*var(--board-scale))] items-center justify-center rounded-row border border-dashed">
          Libre
        </p>
      ) : (
        <CurrentCar current={lane.current} />
      )}

      {lane.queued.length === 0 ? null : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-text-faint text-label">Le espera</span>
            <span className="text-text-faint text-label tabular-nums">{lane.queued.length}</span>
          </div>
          {lane.queued.map((ticket) => (
            <QueuedRow key={ticket.id} ticket={ticket} now={now} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** El carro que tiene encima, con el cronómetro grande. */
function CurrentCar({ current }: { current: BoardCurrent }) {
  const services = servicesLabel(current.ticket);
  const long = current.elapsedSeconds > LONG_WASH_SECONDS;

  return (
    <div className="border-line-soft bg-surface-2 flex flex-col gap-2 rounded-row border p-3.5">
      <PlateChip plate={current.ticket.vehicle.plate} size="lg" />
      <p className="text-text board-body m-0 font-semibold">{vehicleLabel(current.ticket)}</p>
      {services === '' ? null : <p className="text-text-dim board-dense m-0">{services}</p>}
      <div className="mt-1 flex items-baseline justify-between gap-2.5">
        <span
          className={cn(
            'board-timer font-display font-bold italic tabular-nums',
            long ? 'text-warn-text' : 'text-flame-text',
          )}
        >
          {elapsedClock(current.elapsedSeconds)}
        </span>
        {current.startedAt === null ? null : (
          <span className="text-text-faint board-dense whitespace-nowrap">
            desde {timeOf(current.startedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Uno de los que esperan en la cola de este lavador. */
function QueuedRow({ ticket, now }: { ticket: Ticket; now: number }) {
  const long = secondsSince(ticket.createdAt, now) > LONG_WAIT_SECONDS;

  return (
    <div className="border-line-soft bg-surface flex min-h-(--touch-min) items-center justify-between gap-2.5 rounded-sm border px-2.5 py-1.5">
      <PlateChip plate={ticket.vehicle.plate} size="sm" />
      <span className="text-text-dim board-dense min-w-0 flex-1 truncate">
        {vehicleLabel(ticket)}
      </span>
      <span
        className={cn(
          'board-dense whitespace-nowrap tabular-nums',
          long ? 'text-warn-text' : 'text-text-faint',
        )}
      >
        {waitLabel(ticket.createdAt)}
      </span>
    </div>
  );
}

/** La franja de lo que ya está listo y espera en el mostrador. */
function ReadyStrip({ ready }: { ready: readonly Ticket[] }) {
  return (
    <section
      aria-label="Listos para cobrar"
      className="border-go/40 bg-surface flex flex-wrap items-center gap-[calc(10px*var(--board-scale))] rounded-card border p-[calc(14px*var(--board-scale))]"
    >
      <div className="mr-2 flex items-center gap-2.5">
        <Stamp tone="ready" label="Listo" />
        <b className="text-text board-headline font-semibold">Listos para cobrar</b>
      </div>

      {ready.length === 0 ? (
        <span className="text-text-faint board-body">Nada por cobrar</span>
      ) : (
        ready.map((ticket) => {
          const washer = laneWasherOf(ticket);

          return (
            <span
              key={ticket.id}
              className="border-line-soft bg-surface-2 text-text-dim board-dense inline-flex min-h-(--touch-min) items-center gap-2.5 rounded-control border py-1.5 pl-1.5 pr-2.5"
            >
              <PlateChip plate={ticket.vehicle.plate} size="sm" />
              <span>{washer === null ? 'Oficina' : givenName(washer.fullName)}</span>
              <span className="text-text-faint whitespace-nowrap">
                hace {waitLabel(ticket.readyAt ?? ticket.createdAt)}
              </span>
            </span>
          );
        })
      )}
    </section>
  );
}

/** El pie: cuántos sacó cada uno hoy y cuánto tarda en promedio. */
function DoneToday({ washers }: { washers: readonly BoardLane[] }) {
  // La barra es relativa al que más sacó, no a una meta: acá no hay cuota.
  const max = Math.max(1, ...washers.map((lane) => lane.doneToday.length));

  return (
    <section aria-label="Terminados hoy" className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-3">
        <b className="text-text board-headline font-semibold">Terminados hoy</b>
        <span className="text-text-faint text-label">por lavador</span>
      </div>

      <div className="grid grid-cols-1 gap-[calc(14px*var(--board-scale))] md:auto-cols-[1fr] md:grid-flow-col">
        {washers.map((lane) => {
          const done = lane.doneToday.length;

          return (
            <div
              key={lane.washer.id}
              className="border-line-soft bg-surface grid grid-cols-[auto_1fr] items-end gap-x-3.5 gap-y-2 rounded-row border px-3.5 py-3"
            >
              <span
                className={cn(
                  'board-timer font-display font-bold italic tabular-nums',
                  done === max ? 'text-flame-text' : 'text-text',
                )}
              >
                {done}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5 pb-1">
                <span className="text-text board-body truncate font-semibold">
                  {lane.washer.fullName}
                </span>
                <span className="text-text-dim board-dense">
                  {averageLabel(lane.averageSeconds)}
                </span>
              </div>
              <div
                role="img"
                aria-label={`${done} de ${max}`}
                className="bg-surface-3 col-span-2 h-[calc(8px*var(--board-scale))] overflow-hidden rounded-full"
              >
                <span
                  className="gradient-action block h-full rounded-full"
                  style={{ width: `${(done / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
