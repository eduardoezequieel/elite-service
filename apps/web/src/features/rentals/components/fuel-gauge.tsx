'use client';

import { FUEL_EIGHTHS_MAX, fuelLabel } from '@elite/shared';
import { Fuel } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { cn } from '@/lib/utils';
import { FUEL_QUARTERS, fuelQuarterLabel } from '../fuel-scale';

/**
 * spec 126, RN-1 — El combustible de regreso en un indicador de tablero:
 * semicírculo con aguja, por cuartos (0/2/4/6/8 octavos de `FUEL_QUARTERS`).
 * La aguja fantasma «Salió» marca el nivel de la entrega. Se toca, se arrastra
 * o se mueve con las flechas, Inicio y Fin (`role="slider"`).
 *
 * Lienzo de 300 × 196: el centro en (150, 160), vacío a la izquierda y lleno
 * a la derecha. Colores solo con tokens.
 */
const WIDTH = 300;
const HEIGHT = 196;
const CX = 150;
const CY = 160;
const RADIUS = 112;
const STEP = 2;
const MARKS: readonly [number, string][] = [
  [0, 'E'],
  [2, '¼'],
  [4, '½'],
  [6, '¾'],
  [8, 'F'],
];

const angleOf = (eighths: number) => Math.PI - (eighths / FUEL_EIGHTHS_MAX) * Math.PI;

function point(eighths: number, radius: number): [number, number] {
  const angle = angleOf(eighths);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arc(from: number, to: number, radius: number): string {
  const [x0, y0] = point(from, radius);
  const [x1, y1] = point(to, radius);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

const labelOf = (eighths: number) => fuelQuarterLabel(eighths) ?? fuelLabel(eighths);

/** El cuarto más cercano al punto tocado. */
function levelAt(svg: SVGSVGElement, clientX: number, clientY: number): number {
  const box = svg.getBoundingClientRect();
  const x = ((clientX - box.left) * WIDTH) / box.width - CX;
  const y = CY - ((clientY - box.top) * HEIGHT) / box.height;
  let angle = Math.atan2(y, x);
  if (angle < 0) angle = x < 0 ? Math.PI : 0;
  const quarters = Math.round(((Math.PI - angle) / Math.PI) * (FUEL_QUARTERS.length - 1));

  return Math.max(0, Math.min(FUEL_EIGHTHS_MAX, quarters * STEP));
}

export function FuelGauge({
  value,
  pickup,
  onChange,
  invalid = false,
}: {
  value: number | null;
  /** El nivel con que salió el carro; `null` si no hubo inspección de salida. */
  pickup: number | null;
  onChange: (eighths: number) => void;
  invalid?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  function set(level: number) {
    if (level !== value) onChange(level);
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    const svg = ref.current;
    if (svg === null) return;
    event.preventDefault();
    svg.setPointerCapture(event.pointerId);
    svg.focus();
    setDragging(true);
    set(levelAt(svg, event.clientX, event.clientY));
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const svg = ref.current;
    if (!dragging || svg === null) return;
    set(levelAt(svg, event.clientX, event.clientY));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const current = value ?? 0;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? FUEL_EIGHTHS_MAX
          : event.key === 'ArrowRight' || event.key === 'ArrowUp'
            ? current + STEP
            : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
              ? current - STEP
              : null;
    if (next === null) return;
    event.preventDefault();
    set(Math.max(0, Math.min(FUEL_EIGHTHS_MAX, next)));
  }

  const ghost = pickup === null ? null : { tip: point(pickup, 92), text: point(pickup, 52) };

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="slider"
      tabIndex={0}
      aria-label="Combustible"
      aria-valuemin={0}
      aria-valuemax={FUEL_EIGHTHS_MAX}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? undefined : labelOf(value)}
      aria-invalid={invalid || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={onKeyDown}
      className="mx-auto block h-auto w-full max-w-(--gauge-w) cursor-pointer touch-none select-none rounded-card outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flame-hot"
    >
      <path
        d={`M 18 ${CY} A 132 132 0 0 1 282 ${CY} Z`}
        className={cn('fill-surface-2', invalid ? 'stroke-danger' : 'stroke-line')}
        strokeWidth={1.5}
      />
      <path
        d={arc(0, 8, RADIUS)}
        className="stroke-surface-3"
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path
        d={arc(0, 1, RADIUS)}
        className="stroke-danger/45"
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {value !== null && value > 0 ? (
        <path
          d={arc(0, value, RADIUS)}
          className="stroke-flame"
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
        />
      ) : null}
      {Array.from({ length: FUEL_EIGHTHS_MAX + 1 }, (_, index) => {
        const major = index % 2 === 0;
        const [x0, y0] = point(index, major ? 88 : 94);
        const [x1, y1] = point(index, 100);
        return (
          <line
            key={index}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            className={major ? 'stroke-text-dim' : 'stroke-text-faint'}
            strokeWidth={major ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      {MARKS.map(([level, text]) => {
        const [x, y] = point(level, 72);
        return (
          <text
            key={level}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            className={cn(
              'font-sans',
              level === value ? 'fill-text font-bold' : 'fill-text-dim font-semibold',
            )}
          >
            {text}
          </text>
        );
      })}
      {ghost === null ? null : (
        <g aria-hidden>
          <line
            x1={CX}
            y1={CY}
            x2={ghost.tip[0]}
            y2={ghost.tip[1]}
            className="stroke-text-faint"
            strokeWidth={2.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <text
            x={ghost.text[0]}
            y={ghost.text[1] - 8}
            textAnchor="middle"
            fontSize={11}
            className="fill-text-faint font-sans font-semibold"
          >
            Salió
          </text>
        </g>
      )}
      <Fuel
        x={139}
        y={106}
        width={22}
        height={22}
        className="text-text-dim"
        strokeWidth={1.5}
        aria-hidden
      />
      {value === null ? null : (
        <g
          className={cn(
            'fill-flame',
            dragging ? undefined : 'transition-transform duration-(--duration-enter) ease-standard',
          )}
          style={{
            transform: `rotate(${(value / FUEL_EIGHTHS_MAX) * 180}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
          }}
        >
          <path d={`M ${CX} ${CY - 5} L 50 ${CY} L ${CX} ${CY + 5} Z`} />
        </g>
      )}
      <circle cx={CX} cy={CY} r={11} className="fill-surface-3 stroke-line" strokeWidth={1.5} />
      <circle cx={CX} cy={CY} r={4} className="fill-flame" />
      <text
        x={CX}
        y={192}
        textAnchor="middle"
        fontSize={24}
        className="fill-text font-display font-extrabold italic"
      >
        {value === null ? '—' : labelOf(value)}
      </text>
    </svg>
  );
}
