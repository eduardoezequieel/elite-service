'use client';

import { VERDICT_LABELS } from '@elite/shared';
import type { VehicleMonthRow } from '@elite/shared';
import { useId, useState, type PointerEvent, type ReactNode } from 'react';

import { FloatingTip } from '@/components/ui/help-tip';
import { cn } from '@/lib/utils';
import { monthBarsScale, monthLong, monthShort, signedMoney } from '../report-view';

/** Alto del área de dibujo, en unidades del `viewBox`. */
const PLOT_H = 200;
/** Ancho de la barra en px (y en unidades): nunca más de 24. */
const BAR_W = 22;
const RADIUS = 4;

/**
 * La gráfica de 12 meses de un carro (100): columnas de una sola serie —«lo
 * que quedó»— desde el cero, sin librería y con los tokens del tema.
 *
 * Arriba del cero en `--go`; abajo en `--danger` y además rayada, para que la
 * pérdida no dependa del color (verde y rojo se confunden con daltonismo): la
 * dirección y la textura la dicen solas. Punta redondeada a 4px y arranque
 * recto en el cero. Cada mes es un SVG de ancho fijo dentro de su columna,
 * así la barra no se estira con la pantalla. Pasar el mouse, llegar con el
 * teclado o tocar un mes abre el globo con la cifra; la tabla de abajo es la
 * vista accesible completa.
 */
export function MonthsChart({ rows }: { rows: readonly VehicleMonthRow[] }) {
  const pattern = `loss-hatch-${useId().replaceAll(':', '')}`;
  const scale = monthBarsScale(rows);
  const zeroY = PLOT_H * scale.upShare;
  const columns = { gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` };

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-text-dim flex flex-wrap items-center gap-x-4 gap-y-1 text-dense">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="bg-go size-2.5 rounded-[2px]" />
          Quedó
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden viewBox="0 0 10 10" className="text-danger size-2.5">
            <rect width="10" height="10" rx="2" fill={`url(#${pattern})`} />
          </svg>
          Pérdida
        </span>
      </figcaption>

      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <pattern
            id={pattern}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="currentColor" opacity="0.35" />
            <rect width="2.5" height="6" fill="currentColor" />
          </pattern>
        </defs>
      </svg>

      <div className="relative h-48 w-full [[data-density=bahia]_&]:h-64">
        <span
          aria-hidden
          className="bg-line absolute inset-x-0 h-px"
          style={{ top: `${scale.upShare * 100}%` }}
        />
        <ol className="absolute inset-0 grid" style={columns}>
          {rows.map((row, index) => {
            const bar = scale.bars[index];
            const height = bar === undefined ? 0 : Math.abs(bar.ratio) * PLOT_H;

            return (
              <li key={row.month} className="flex">
                <MonthHit row={row}>
                  <svg
                    aria-hidden
                    viewBox={`0 0 ${BAR_W} ${PLOT_H}`}
                    preserveAspectRatio="none"
                    className="h-full overflow-visible"
                    style={{ width: BAR_W }}
                  >
                    {height < 0.5 || bar === undefined ? null : bar.value >= 0 ? (
                      <path
                        className="text-go"
                        fill="currentColor"
                        d={roundedUp(0, zeroY, BAR_W, height)}
                      />
                    ) : (
                      <path
                        className="text-danger"
                        fill={`url(#${pattern})`}
                        d={roundedDown(0, zeroY, BAR_W, height)}
                      />
                    )}
                  </svg>
                </MonthHit>
              </li>
            );
          })}
        </ol>
      </div>

      <ol
        aria-hidden
        className="text-text-faint grid text-center text-dense [[data-density=bahia]_&]:text-body"
        style={columns}
      >
        {rows.map((row) => (
          <li key={row.month}>{monthShort(row.month)}</li>
        ))}
      </ol>
    </figure>
  );
}

function MonthHit({ row, children }: { row: VehicleMonthRow; children: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tip = row.future
    ? `${monthLong(row.month)}: todavía no empieza`
    : `${monthLong(row.month)}: quedó ${signedMoney(row.net)} · ingresos $${row.income} · ${VERDICT_LABELS[row.verdict]}`;

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={tip}
        onPointerEnter={(event: PointerEvent) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
        }}
        onClick={() => setPinned((value) => !value)}
        className={cn(
          'flex h-full min-h-(--touch-min) w-full justify-center rounded-sm transition-colors duration-(--duration-state) ease-standard',
          'hover:bg-surface-2 focus-visible:bg-surface-2',
        )}
      >
        {children}
      </button>
      <FloatingTip anchor={anchor} open={hovered || focused || pinned}>
        {tip}
      </FloatingTip>
    </>
  );
}

/** Una columna hacia arriba: arranque recto en el cero y punta de 4px. */
function roundedUp(x: number, zeroY: number, width: number, height: number): string {
  const r = Math.min(RADIUS, height, width / 2);
  const top = zeroY - height;

  return [
    `M${x},${zeroY}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + width - r}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `V${zeroY}`,
    'Z',
  ].join(' ');
}

/** Una columna hacia abajo, con la punta redondeada abajo. */
function roundedDown(x: number, zeroY: number, width: number, height: number): string {
  const r = Math.min(RADIUS, height, width / 2);
  const bottom = zeroY + height;

  return [
    `M${x},${zeroY}`,
    `V${bottom - r}`,
    `Q${x},${bottom} ${x + r},${bottom}`,
    `H${x + width - r}`,
    `Q${x + width},${bottom} ${x + width},${bottom - r}`,
    `V${zeroY}`,
    'Z',
  ].join(' ');
}
