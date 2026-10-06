'use client';

import { INSPECTION_ZONE_LABELS } from '@elite/shared';
import type { InspectionZone } from '@elite/shared';
import type { KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

/**
 * El carro visto desde arriba, con las 18 zonas de la inspección (RN-7)
 * tocables. Cada zona es un botón de verdad (`role="button"`, `aria-pressed`,
 * Enter y espacio); el estado se dice también en la lista de daños de abajo,
 * nunca solo con el color. Los colores salen de tokens con `currentColor`.
 *
 * Coordenadas en un lienzo de 200 × 400: el frente arriba, la izquierda del
 * conductor a la izquierda.
 */
type Shape = { x: number; y: number; width: number; height: number; rx?: number };

const ZONE_SHAPES: Record<InspectionZone, readonly Shape[]> = {
  front_bumper: [{ x: 40, y: 8, width: 120, height: 26, rx: 12 }],
  hood: [{ x: 46, y: 36, width: 108, height: 70, rx: 6 }],
  windshield: [{ x: 50, y: 108, width: 100, height: 32, rx: 4 }],
  roof: [{ x: 50, y: 142, width: 100, height: 110, rx: 4 }],
  rear_window: [{ x: 50, y: 254, width: 100, height: 28, rx: 4 }],
  trunk: [{ x: 46, y: 284, width: 108, height: 70, rx: 6 }],
  rear_bumper: [{ x: 40, y: 356, width: 120, height: 26, rx: 12 }],
  left_front_fender: [{ x: 15, y: 36, width: 29, height: 70, rx: 6 }],
  left_front_door: [{ x: 15, y: 108, width: 29, height: 72, rx: 4 }],
  left_rear_door: [{ x: 15, y: 182, width: 29, height: 72, rx: 4 }],
  left_rear_fender: [{ x: 15, y: 256, width: 29, height: 98, rx: 6 }],
  right_front_fender: [{ x: 156, y: 36, width: 29, height: 70, rx: 6 }],
  right_front_door: [{ x: 156, y: 108, width: 29, height: 72, rx: 4 }],
  right_rear_door: [{ x: 156, y: 182, width: 29, height: 72, rx: 4 }],
  right_rear_fender: [{ x: 156, y: 256, width: 29, height: 98, rx: 6 }],
  left_mirror: [{ x: 0, y: 112, width: 14, height: 26, rx: 4 }],
  right_mirror: [{ x: 186, y: 112, width: 14, height: 26, rx: 4 }],
  wheels: [
    { x: 0, y: 50, width: 14, height: 42, rx: 4 },
    { x: 186, y: 50, width: 14, height: 42, rx: 4 },
    { x: 0, y: 290, width: 14, height: 42, rx: 4 },
    { x: 186, y: 290, width: 14, height: 42, rx: 4 },
  ],
};

/** Cómo se pinta una zona. */
export type ZoneMark = 'none' | 'marked' | 'previous' | 'new';

const MARK_CLASS: Record<ZoneMark, string> = {
  none: 'text-line fill-surface-2',
  marked: 'text-flame fill-flame/25',
  /** En la recepción: lo que ya venía de la salida, tenue y punteado. */
  previous: 'text-text-faint fill-text-faint/15 [stroke-dasharray:4_3]',
  /** En la recepción: lo que apareció ahora. */
  new: 'text-danger-text fill-danger/35',
};

export function CarDiagram({
  markOf,
  onToggle,
  locked,
  disabled = false,
}: {
  markOf: (zone: InspectionZone) => ZoneMark;
  onToggle?: (zone: InspectionZone) => void;
  /** Zona que no se toca (108: un golpe de la salida, al recibir). */
  locked?: (zone: InspectionZone) => boolean;
  disabled?: boolean;
}) {
  const interactive = onToggle !== undefined && !disabled;

  function onKey(event: KeyboardEvent<SVGGElement>, zone: InspectionZone) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle?.(zone);
    }
  }

  return (
    <svg
      viewBox="0 0 200 390"
      className="mx-auto block h-auto w-full max-w-64 [[data-density=bahia]_&]:max-w-80"
      role="group"
      aria-label="Zonas del carro, vistas desde arriba. El frente está arriba."
    >
      {(Object.keys(ZONE_SHAPES) as InspectionZone[]).map((zone) => {
        const mark = markOf(zone);
        const pressed = mark === 'marked' || mark === 'new';
        const frozen = locked?.(zone) === true;
        const tappable = interactive && !frozen;

        return (
          <g
            key={zone}
            role={interactive ? 'button' : 'img'}
            tabIndex={tappable ? 0 : frozen ? -1 : undefined}
            aria-disabled={frozen || undefined}
            aria-pressed={interactive ? pressed : undefined}
            aria-label={`${INSPECTION_ZONE_LABELS[zone]}${
              mark === 'previous'
                ? ' (ya venía)'
                : mark === 'new'
                  ? ' (daño nuevo)'
                  : pressed
                    ? ' (con daño)'
                    : ''
            }`}
            onClick={tappable ? () => onToggle?.(zone) : undefined}
            onKeyDown={tappable ? (event) => onKey(event, zone) : undefined}
            className={cn(
              'stroke-current transition-colors duration-(--duration-state) ease-standard',
              MARK_CLASS[mark],
              tappable && 'cursor-pointer',
            )}
          >
            {ZONE_SHAPES[zone].map((shape, index) => (
              <rect
                key={index}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={shape.rx ?? 0}
                strokeWidth={1.5}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
