'use client';

import type { Ticket, WorkOrderStatus } from '@elite/shared';
import { useEffect, useState } from 'react';

import { STAMP_TONE_TEXT } from '@/components/ui/stamp';
import { cn } from '@/lib/utils';
import { durationLabel, secondsSince } from '../duration';
import { statusSinceOf } from '../status-since';
import { timeOf } from '../wait';
import { statusLook } from './ticket-status-stamp';

/**
 * El ciclo que se dibuja en pasos. `VOID` no es un paso: corta el ciclo. La
 * pista no cobra, así que pasa los tres primeros (066).
 */
const OFFICE_STEPS: readonly WorkOrderStatus[] = ['OPEN', 'WASHING', 'READY', 'PAID'];

/** Minuto a minuto alcanza: el contador de segundos vive en la línea de tiempo. */
const TICK_MS = 30_000;

/**
 * El estado del lavado en grande, arriba del panel del detalle (064).
 *
 * El chip de la cabecera nombra el estado; esto lo hace visible desde lejos:
 * icono, palabra en `text-figure` y desde cuándo. Debajo, los cuatro pasos del
 * ciclo con lo hecho y lo actual en el tono del estado. Tono, icono y palabra
 * salen de `ticket-status-stamp.tsx`, como la marca de 063.
 */
export function TicketStatusHero({
  ticket,
  steps = OFFICE_STEPS,
}: {
  ticket: Ticket;
  steps?: readonly WorkOrderStatus[];
}) {
  const { label, tone, icon } = statusLook(ticket.status);
  const since = statusSinceOf(ticket);
  const closed = ticket.status === 'PAID' || ticket.status === 'VOID';
  const now = useNow(since !== null && !closed);
  const current = steps.indexOf(ticket.status);

  return (
    <div className="flex flex-col gap-3.5">
      <div
        className={cn(
          'tint rounded-row flex items-center gap-3.5 border px-4 py-4',
          STAMP_TONE_TEXT[tone],
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 [&_svg]:size-7.5 [&_svg]:stroke-[1.75]',
            ticket.status === 'WASHING' && 'animate-[elite-pulse_1.6s_ease-in-out_infinite]',
          )}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-figure leading-none [[data-density=bahia]_&]:text-(length:--hero-size-lg)">
            {label}
          </p>
          {since === null ? null : (
            <p className="text-text-dim text-dense">
              {closed ? (
                `a las ${timeOf(since)}`
              ) : (
                <>
                  desde las {timeOf(since)} ·{' '}
                  <span className="text-text font-semibold tabular-nums">
                    {durationLabel(secondsSince(since, now))}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Anulado corta el ciclo: sin pasos que mostrar. La palabra ya está
          arriba, así que los pasos no se leen en voz alta. */}
      {current === -1 ? null : (
        <ol
          aria-hidden
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, index) => (
            <li
              key={step}
              className={cn(
                'text-label flex flex-col gap-1.5 [[data-density=bahia]_&]:text-dense',
                index === current ? 'text-text' : 'text-text-faint',
              )}
            >
              <span
                className={cn(
                  'h-1.5 rounded-full [[data-density=bahia]_&]:h-2',
                  // Lo hecho y lo actual, en el tono del estado; lo que falta, en filete.
                  index <= current ? cn('bg-current', STAMP_TONE_TEXT[tone]) : 'bg-line',
                )}
              />
              {statusLook(step).label}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;

    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);

    return () => window.clearInterval(id);
  }, [running]);

  return now;
}
