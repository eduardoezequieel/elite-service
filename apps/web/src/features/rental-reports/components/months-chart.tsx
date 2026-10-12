'use client';

import { VERDICT_LABELS } from '@elite/shared';
import type { VehicleMonthRow } from '@elite/shared';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';
import { monthBarsScale, monthName, monthShort, signedMoney } from '../report-view';

/** Alto del área de dibujo, en unidades del `viewBox`. */
const PLOT_H = 200;
/** Ancho de la barra en px (y en unidades): nunca más de 24. */
const BAR_W = 22;
const RADIUS = 4;

/**
 * La gráfica de 12 meses de un carro (100): columnas de una sola serie —«lo
 * que quedó»— desde el cero, sin librería y con los tokens del tema. Tocar un
 * mes lo elige; el detalle vive abajo, no en los doce a la vez.
 *
 * Arriba del cero en `--go`; abajo en `--danger` y además rayada, para que la
 * pérdida no dependa del color. Punta redondeada a 4px y arranque recto en el
 * cero. Cada mes es un SVG de ancho fijo dentro de su columna.
 */
export function MonthsChart({
  rows,
  selected,
  onSelect,
}: {
  rows: readonly VehicleMonthRow[];
  /** `YYYY-MM` del mes abierto. */
  selected: string;
  onSelect: (month: string) => void;
}) {
  const pattern = `loss-hatch-${useId().replaceAll(':', '')}`;
  const scale = monthBarsScale(rows);
  const zeroY = PLOT_H * scale.upShare;
  const columns = { gridTemplateColumns: `repeat(${rows.length}, minmax(3rem, 1fr))` };
  const group = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const year = rows[0]?.month.slice(0, 4) ?? '';

  useEffect(() => {
    const button = group.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    const scroller = group.current?.parentElement;

    if (button === undefined || button === null || scroller === undefined || scroller === null) {
      return;
    }

    const buttonBox = button.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();

    if (buttonBox.left < box.left) scroller.scrollLeft -= box.left - buttonBox.left;
    else if (buttonBox.right > box.right) scroller.scrollLeft += buttonBox.right - box.right;

    if (!moveFocus.current) return;

    moveFocus.current = false;
    button.focus();
  }, [selected]);

  function move(delta: number) {
    const index = rows.findIndex((row) => row.month === selected);
    const next = rows[index + delta];

    if (next === undefined || next.month === selected) return;

    moveFocus.current = true;
    onSelect(next.month);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-text-dim flex flex-wrap items-center gap-x-4 gap-y-1 text-dense">
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
      </div>

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

      <div className="overflow-x-auto">
        <div
          ref={group}
          role="radiogroup"
          aria-label={year === '' ? 'Meses del año' : `Meses de ${year}`}
          className="grid"
          style={columns}
          onKeyDown={onKeyDown}
        >
          {rows.map((row, index) => {
            const bar = scale.bars[index];
            const height = bar === undefined ? 0 : Math.abs(bar.ratio) * PLOT_H;
            const on = row.month === selected;
            const drawn = !row.future && bar !== undefined && height >= 0.5;

            return (
              <button
                key={row.month}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={monthControlLabel(row)}
                tabIndex={on ? 0 : -1}
                onClick={() => onSelect(row.month)}
                className={cn(
                  'flex min-h-(--touch-min) w-full min-w-0 flex-col rounded-t-lg transition-colors duration-(--duration-state) ease-standard',
                  on ? 'bg-flame/14 text-text' : 'text-text-faint hover:bg-surface-2',
                )}
              >
                <span className="relative flex h-48 w-full items-center justify-center [[data-density=bahia]_&]:h-64">
                  <span
                    aria-hidden
                    className="bg-line absolute inset-x-0 h-px"
                    style={{ top: `${scale.upShare * 100}%` }}
                  />
                  {drawn && bar !== undefined ? (
                    <svg
                      aria-hidden
                      viewBox={`0 0 ${BAR_W} ${PLOT_H}`}
                      preserveAspectRatio="none"
                      className="h-full overflow-visible"
                      style={{ width: BAR_W }}
                    >
                      {bar.value >= 0 ? (
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
                  ) : row.future ? null : (
                    <span
                      aria-hidden
                      className="bg-text-faint absolute left-1/2 h-0.5 w-3.5 -translate-x-1/2 rounded-sm"
                      style={{ top: `calc(${scale.upShare * 100}% - 1px)` }}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'border-b-2 border-transparent py-1.5 text-center text-dense font-semibold [[data-density=bahia]_&]:text-body',
                    on && 'border-flame',
                  )}
                >
                  {monthShort(row.month)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function monthControlLabel(row: VehicleMonthRow): string {
  const name = monthName(row.month);

  if (row.future) return `${name}, todavía no empieza`;
  if (row.verdict === 'NONE') return `${name}, sin uso`;

  return `${name}, quedó ${signedMoney(row.net)}, ${VERDICT_LABELS[row.verdict].toLowerCase()}`;
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
