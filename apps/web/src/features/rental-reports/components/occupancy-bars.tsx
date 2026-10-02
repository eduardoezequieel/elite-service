'use client';

import { useState, type PointerEvent } from 'react';

import { FloatingTip } from '@/components/ui/help-tip';
import { dayLabel } from '@/lib/civil-date';
import { cn } from '@/lib/utils';

/**
 * Los próximos 7 días (100): barras horizontales de una serie con el patrón de
 * la 067 —llama llena, 14px en `mostrador` y 22px en `bahia`, punta de 4px—.
 * La escala es la flota entera, no el máximo: una barra completa es «no queda
 * ninguno libre». El valor va escrito a la derecha («3 de 5»).
 */
export function OccupancyBars({
  days,
}: {
  days: readonly { date: string; occupied: number; total: number }[];
}) {
  return (
    <ul className="border-line-soft bg-surface flex flex-col gap-1 rounded-row border px-3 py-2.5">
      {days.map((day, index) => (
        <li key={day.date}>
          <OccupancyRow day={day} label={index === 0 ? 'Hoy' : dayLabel(day.date)} />
        </li>
      ))}
    </ul>
  );
}

function OccupancyRow({
  day,
  label,
}: {
  day: { date: string; occupied: number; total: number };
  label: string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const width = day.total > 0 ? (day.occupied / day.total) * 100 : 0;
  const full = day.total > 0 && day.occupied >= day.total;
  const tip = `${label}: ${day.occupied} de ${day.total} carros ocupados${full ? ', no queda ninguno libre' : ''}`;

  return (
    <>
      <div
        ref={setAnchor}
        role="img"
        tabIndex={0}
        aria-label={tip}
        onPointerEnter={(event: PointerEvent) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          'text-text grid min-h-(--touch-min) w-full items-center gap-x-3 gap-y-0.5 rounded-sm px-1.5 py-1.5 text-body [[data-density=bahia]_&]:text-(length:--lead-size)',
          "grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'label_value'_'track_track']",
          "sm:grid-cols-[minmax(110px,200px)_minmax(0,1fr)_auto] sm:py-0 sm:[grid-template-areas:'label_track_value']",
          'focus-visible:bg-surface-2',
        )}
      >
        <span className="truncate text-left [grid-area:label]">{label}</span>
        <span className="bg-surface-2 relative flex h-6 items-center rounded-r-(--bar-radius) [grid-area:track] [[data-density=bahia]_&]:h-8">
          <span
            className="bg-flame h-3.5 rounded-r-(--bar-radius) [[data-density=bahia]_&]:h-5.5"
            style={{ width: `${width}%` }}
          />
        </span>
        <span className="min-w-16 text-right font-semibold tabular-nums [grid-area:value]">
          {day.occupied}
          <span className="text-text-faint font-normal"> de {day.total}</span>
          {full ? <span className="text-flame-text ml-1.5 text-dense">Lleno</span> : null}
        </span>
      </div>
      <FloatingTip anchor={anchor} open={hovered || focused}>
        {tip}
      </FloatingTip>
    </>
  );
}
