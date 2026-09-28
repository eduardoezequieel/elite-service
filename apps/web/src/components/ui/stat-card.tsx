'use client';

import * as React from 'react';

import { HelpTip } from '@/components/ui/help-tip';
import { useChangeMark } from '@/lib/use-motion';
import { cn } from '@/lib/utils';

/**
 * La tarjeta de estadística.
 *
 * Rótulo tenue arriba, cifra grande en Saira itálica debajo y una unidad chica
 * al lado si hace falta («2 carros», «$148.00»). Es la forma que tiene el
 * mostrador de ver el día de un vistazo.
 *
 * `children` es el hueco para meter algo al lado de la cifra —el medidor de
 * segmentos, por ejemplo—: la tarjeta se acomoda en fila cuando lo hay.
 *
 * `help` pone el icono de ayuda al lado del rótulo (spec 067) y `detail`, una
 * línea de apoyo bajo la cifra («sobre $420.00 en ventas»). Sin ellos la
 * tarjeta es exactamente la de siempre.
 */
export interface StatCardProps extends React.ComponentProps<'div'> {
  /** Qué se está contando. */
  label: string;
  /** La cifra ya formateada. */
  value: React.ReactNode;
  /** Unidad o resto tenue al lado de la cifra: «carros», «de 18», «.00». */
  unit?: React.ReactNode;
  /** `go` pinta la cifra en verde: se usa solo para «listos» y «cobrado». */
  tone?: 'default' | 'go' | 'flame';
  /** Icono de apoyo para la tarjeta. */
  icon?: React.ReactNode;
  /** Lo que va al lado de la cifra, como el `<SegmentGauge>`. */
  children?: React.ReactNode;
  /** Qué significa la cifra: sale en el icono de ayuda junto al rótulo (067). */
  help?: string;
  /** Línea de apoyo bajo la cifra: con qué se compara, de dónde sale (067). */
  detail?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  unit,
  tone = 'default',
  icon,
  children,
  help,
  detail,
  className,
  ...props
}: StatCardProps) {
  const isDecimalUnit = typeof unit === 'string' && unit.startsWith('.');
  // La cifra que cambia a la vista salta una vez (088). Solo se compara texto o
  // número: un nodo armado es otro objeto en cada render aunque diga lo mismo.
  const changed = useChangeMark(
    typeof value === 'string' || typeof value === 'number' ? value : null,
  );

  return (
    <div
      data-slot="stat-card"
      data-tone={tone}
      className={cn(
        'border-line bg-surface flex min-h-24 items-center justify-between gap-3.5 rounded-row border px-4.5 py-4 transition-colors',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {help === undefined ? (
          <p className="text-text-dim m-0 truncate text-dense font-medium">{label}</p>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="text-text-dim m-0 truncate text-dense font-medium">{label}</p>
            <HelpTip text={help} />
          </div>
        )}
        <div
          // El tablero de pista (049) agranda esta cifra desde `globals.css`:
          // sin un asidero propio habría que apuntarle por su marcado.
          data-slot="stat-card-value"
          data-changed={changed}
          className={cn(
            'mt-1.5 flex items-baseline font-display text-(length:--stat-size) font-bold italic leading-none tabular-nums tracking-tight sm:text-(length:--stat-size-wide)',
            tone === 'go' ? 'text-go-text' : tone === 'flame' ? 'text-flame-text' : 'text-text',
          )}
        >
          <span>{value}</span>
          {unit !== undefined && unit !== null ? (
            <span
              className={cn(
                'text-text-faint font-sans text-body font-medium not-italic leading-none',
                isDecimalUnit ? 'ml-0 text-title' : 'ml-1.5',
              )}
            >
              {unit}
            </span>
          ) : null}
        </div>
        {detail === undefined || detail === null ? null : (
          <div
            data-slot="stat-card-detail"
            className="text-text-dim mt-1.5 text-dense [[data-density=bahia]_&]:text-body"
          >
            {detail}
          </div>
        )}
      </div>

      {children ? (
        <div className="flex shrink-0 items-center justify-center">{children}</div>
      ) : icon ? (
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-control border transition-colors',
            tone === 'go'
              ? 'border-go/25 bg-go/10 text-go-text'
              : tone === 'flame'
                ? 'border-flame/25 bg-flame/10 text-flame-text'
                : 'border-line-soft bg-surface-2 text-text-dim',
          )}
        >
          {icon}
        </div>
      ) : null}
    </div>
  );
}
