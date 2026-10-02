'use client';

import { VERDICT_LABELS } from '@elite/shared';
import type { VehicleLifetime, Verdict } from '@elite/shared';
import type { ReactNode } from 'react';

import { Stamp } from '@/components/ui/stamp';
import { cn } from '@/lib/utils';
import { VERDICT_TONES, recoveredLabel } from '../report-view';

/** Una sección de pantalla: título y, a la derecha, el dato que la resume. */
export function ReportSection({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-title text-text">{title}</h2>
        {aside === undefined ? null : (
          <p className="text-text-dim text-dense tabular-nums [[data-density=bahia]_&]:text-body">
            {aside}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** El veredicto con su palabra: Ganancia, Cubrió su costo, Pérdida, Sin uso. */
export function VerdictStamp({ verdict }: { verdict: Verdict }) {
  return <Stamp label={VERDICT_LABELS[verdict]} tone={VERDICT_TONES[verdict]} />;
}

/**
 * Inversión recuperada: la palabra cuando ya se pagó solo o faltan datos, y si
 * no, el porcentaje escrito con una barra de 6px debajo. La cifra nunca
 * depende de medir la barra.
 */
export function RecoveredMeter({ lifetime }: { lifetime: Pick<VehicleLifetime, 'recovered'> }) {
  const label = recoveredLabel(lifetime);

  if (lifetime.recovered === null) return <span className="text-text-faint">{label}</span>;
  if (lifetime.recovered >= 1) return <span className="text-go-text font-semibold">{label}</span>;

  const width = Math.max(0, Math.min(1, lifetime.recovered)) * 100;

  return (
    <span className="flex min-w-24 flex-col gap-1">
      <span className="font-mono tabular-nums">{label}</span>
      <span aria-hidden className="bg-surface-3 h-1.5 w-full rounded-full">
        <span className="bg-flame block h-full rounded-full" style={{ width: `${width}%` }} />
      </span>
    </span>
  );
}
