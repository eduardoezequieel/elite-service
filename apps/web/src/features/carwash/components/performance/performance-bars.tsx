'use client';

import { useState, type PointerEvent } from 'react';

import { FloatingTip } from '@/components/ui/help-tip';
import { cn } from '@/lib/utils';
import { barScaleMax } from '../../performance';

/**
 * Barras horizontales de una sola serie (spec 067): cuánto tarda cada
 * empleado, qué extras se venden.
 *
 * Una barra de llama por fila —14px en `mostrador`, 22px en `bahia`, con la
 * punta redondeada a 4px—, el rótulo a la izquierda y el valor escrito a la
 * derecha: el número nunca depende de medir la barra. `average` dibuja la
 * marca del promedio del equipo con su clave arriba. Pasar el mouse o llegar
 * con el teclado abre el detalle; si la fila tiene `onSelect`, tocarla cambia
 * el alcance.
 */
export interface BarDatum {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  /** La lectura completa: el globo y el nombre accesible de la fila. */
  tip: string;
  onSelect?: () => void;
}

export function PerformanceBars({
  rows,
  average = null,
  averageLabel,
}: {
  rows: readonly BarDatum[];
  average?: number | null;
  averageLabel?: string;
}) {
  const top = barScaleMax(
    rows.map((row) => row.value),
    average,
  );

  return (
    <div className="flex flex-col gap-3">
      {average !== null && averageLabel !== undefined ? (
        <p className="text-text-dim inline-flex items-center gap-2 text-dense">
          <span aria-hidden className="bg-text h-3.5 w-0.5 rounded-full" />
          {averageLabel}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.key}>
            <BarRow row={row} top={top} average={average} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarRow({ row, top, average }: { row: BarDatum; top: number; average: number | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const width = top > 0 ? (row.value / top) * 100 : 0;

  const body = (
    <>
      <span className="truncate text-left [grid-area:label]">{row.label}</span>
      <span className="relative flex h-6 items-center [grid-area:track] [[data-density=bahia]_&]:h-8">
        <span
          className="bg-flame h-3.5 min-w-0.75 rounded-r-(--bar-radius) [[data-density=bahia]_&]:h-5.5"
          style={{ width: `${width}%` }}
        />
        {average !== null && top > 0 ? (
          <span
            aria-hidden
            className="bg-text absolute inset-y-0 -ml-px w-0.5 rounded-full"
            style={{ left: `${(average / top) * 100}%` }}
          />
        ) : null}
      </span>
      <span className="min-w-16 text-right font-semibold tabular-nums [grid-area:value]">
        {row.valueLabel}
      </span>
    </>
  );

  const shared = {
    ref: setAnchor,
    'aria-label': row.tip,
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered(true);
    },
    onPointerLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    className: cn(
      'text-text grid w-full min-h-(--touch-min) items-center gap-x-3 gap-y-0.5 rounded-sm px-1.5 py-1.5 text-body transition-colors duration-(--duration-state) ease-standard [[data-density=bahia]_&]:text-(length:--lead-size)',
      "grid-cols-[minmax(0,1fr)_auto] [grid-template-areas:'label_value'_'track_track']",
      "sm:grid-cols-[minmax(110px,180px)_minmax(0,1fr)_auto] sm:py-0 sm:[grid-template-areas:'label_track_value']",
      'focus-visible:bg-surface-2',
      row.onSelect && 'hover:bg-surface-2 cursor-pointer',
    ),
  };

  return (
    <>
      {row.onSelect ? (
        <button type="button" onClick={row.onSelect} {...shared}>
          {body}
        </button>
      ) : (
        <div role="img" tabIndex={0} {...shared}>
          {body}
        </div>
      )}
      <FloatingTip anchor={anchor} open={hovered || focused}>
        {row.tip}
      </FloatingTip>
    </>
  );
}
