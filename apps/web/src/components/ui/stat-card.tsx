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
  tone?: 'default' | 'go';
  /** Lo que va al lado de la cifra, como el `<SegmentGauge>`. */
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  unit,
  tone = 'default',
  children,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      data-tone={tone}
      className={cn(
        'border-line-soft bg-surface shadow-elite flex items-center gap-3.5 rounded-row border px-[18px] py-4',
        className,
      )}
      {...props}
    >
      {children}

      <div className="min-w-0">
        <p className="text-text-faint m-0 text-dense font-medium">{label}</p>
        <div
          className={cn(
            'text-figure mt-1 leading-tight',
            tone === 'go' ? 'text-go-text' : 'text-text',
          )}
        >
          {value}
          {unit === undefined ? null : (
            <small className="text-text-faint ml-1 text-body font-medium not-italic">{unit}</small>
          )}
        </div>
      </div>
    </div>
  );
}
