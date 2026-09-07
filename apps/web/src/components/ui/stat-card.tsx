import * as React from 'react';

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
}

export function StatCard({
  label,
  value,
  unit,
  tone = 'default',
  icon,
  children,
  className,
  ...props
}: StatCardProps) {
  const isDecimalUnit = typeof unit === 'string' && unit.startsWith('.');

  return (
    <div
      data-slot="stat-card"
      data-tone={tone}
      className={cn(
        'border-line bg-surface flex min-h-[96px] items-center justify-between gap-3.5 rounded-row border px-[18px] py-4 transition-colors',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-text-dim m-0 truncate text-dense font-medium">{label}</p>
        <div
          className={cn(
            'mt-1.5 flex items-baseline font-display text-[28px] font-bold italic leading-none tabular-nums tracking-tight sm:text-[32px]',
            tone === 'go'
              ? 'text-go-text'
              : tone === 'flame'
                ? 'text-flame-text'
                : 'text-text',
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
