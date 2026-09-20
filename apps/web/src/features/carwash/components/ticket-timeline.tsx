'use client';

import type { TicketTimelineSegment, WorkOrderStatus } from '@elite/shared';
import { useEffect, useState } from 'react';

import { useDensity } from '@/components/density-provider';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { durationLabel, liveDurationLabel, secondsSince } from '../duration';
import { useTicketTimeline } from '../hooks/use-tickets';
import { timeOf } from '../wait';
import { TicketStatusStamp } from './ticket-status-stamp';

/**
 * La historia del lavado, para quien tiene `carwash.audit` (046).
 *
 * Responde una sola pregunta: dónde se fue el tiempo. Por eso cada fila lleva
 * su duración y no el par «de X a Y» —el estado anterior ya está escrito en la
 * fila de arriba— y por eso el tramo en curso cuenta solo, con el reloj del
 * navegador: un número congelado en el momento de la consulta mentiría a los
 * pocos segundos.
 */
export function TicketTimeline({ ticketId }: { ticketId: string }) {
  const timeline = useTicketTimeline(ticketId);
  const segments = timeline.data?.segments ?? [];
  const last = segments.at(-1);
  const running = last !== undefined && last.leftAt === null && !isFinal(last.status);
  const now = useNow(running);

  if (timeline.isPending) {
    return (
      <TimelineCard>
        <p className="text-text-dim text-body">Cargando…</p>
      </TimelineCard>
    );
  }

  if (timeline.error !== null || timeline.data === undefined) {
    return (
      <TimelineCard>
        <p className="text-danger-text text-body" role="alert">
          {timeline.error?.message ?? 'No se pudo cargar la línea de tiempo.'}
        </p>
      </TimelineCard>
    );
  }

  if (!timeline.data.recorded) {
    return (
      <TimelineCard>
        <p className="text-text-dim text-body">Este lavado es anterior al registro de tiempos.</p>
      </TimelineCard>
    );
  }

  return (
    <TimelineCard total={durationLabel(totalSeconds(segments, now))}>
      <ol className="flex flex-col">
        {segments.map((segment) => (
          <TimelineRow key={segment.id} segment={segment} now={now} />
        ))}
      </ol>
    </TimelineCard>
  );
}

function TimelineCard({ children, total }: { children: React.ReactNode; total?: string }) {
  return (
    <Card className="gap-2.5 px-card">
      <CardSectionHeading aside={total === undefined ? undefined : `Total ${total}`}>
        Línea de tiempo
      </CardSectionHeading>
      {children}
    </Card>
  );
}

/**
 * La fila de un tramo. En `mostrador` cabe en una línea; en `bahia` se abre en
 * dos, con el sello y la duración arriba y el resto abajo: de pie, con la
 * tablet en la mano, una sola línea obliga a leer de izquierda a derecha datos
 * que ahí no se leen.
 */
function TimelineRow({ segment, now }: { segment: TicketTimelineSegment; now: number }) {
  const { density } = useDensity();
  const duration =
    segment.durationSeconds === null
      ? isFinal(segment.status)
        ? '—'
        : liveDurationLabel(secondsSince(segment.enteredAt, now))
      : durationLabel(segment.durationSeconds);
  const who = segment.actor === null ? 'sin atribuir' : segment.actor.name;

  if (density === 'bahia') {
    return (
      <li className="border-line-soft/60 flex min-h-(--touch-min) flex-col gap-1 border-b py-2.5 last:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <TicketStatusStamp status={segment.status} />
          <span className="text-text text-body tabular-nums">{duration}</span>
        </div>
        <p className="text-text-dim text-dense">
          <span className="tabular-nums">{timeOf(segment.enteredAt)}</span> · {who}
        </p>
      </li>
    );
  }

  return (
    <li className="border-line-soft/60 flex min-h-(--touch-min) items-center gap-3 border-b py-1.5 last:border-b-0">
      <TicketStatusStamp status={segment.status} />
      <span className="text-text-faint text-dense tabular-nums">{timeOf(segment.enteredAt)}</span>
      <span className="text-text-dim text-dense truncate">{who}</span>
      <span className="text-text ml-auto text-body tabular-nums">{duration}</span>
    </li>
  );
}

/** `PAID` y `VOID` cierran la historia: ahí no hay nada que contar (RN-6). */
function isFinal(status: WorkOrderStatus): boolean {
  return status === 'PAID' || status === 'VOID';
}

/** Lo cerrado, más lo que lleva corriendo el tramo abierto (RN-7). */
function totalSeconds(segments: readonly TicketTimelineSegment[], now: number): number {
  const closed = segments.reduce((sum, segment) => sum + (segment.durationSeconds ?? 0), 0);
  const last = segments.at(-1);

  if (last === undefined || last.leftAt !== null || isFinal(last.status)) return closed;

  return closed + secondsSince(last.enteredAt, now);
}

/**
 * El reloj del contador. Late solo mientras hay un tramo abierto: en un lavado
 * cobrado el intervalo no aporta nada y seguiría despertando la pestaña.
 */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const id = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(id);
  }, [active]);

  return now;
}
