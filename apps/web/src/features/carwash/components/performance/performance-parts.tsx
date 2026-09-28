'use client';

import type { ReactNode } from 'react';

import { SegmentGauge } from '@/components/ui/segment-gauge';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { percent, type Delta, type DeltaTone } from '../../performance';

/**
 * Las piezas que comparten las pestañas de Rendimiento (spec 067). Solo
 * presentación: los números llegan hechos del API.
 */

/** Las listas de lavados paginan de a 10. */
export const WASH_PAGE_SIZE = 10;

/** Qué significa cada cifra y cada columna explicada. El texto es el del prototipo. */
export const PERFORMANCE_HELP = {
  washesCharged:
    'Cuántos lavados se cobraron en el rango. Los anulados y los que siguen abiertos no cuentan.',
  washes: 'Los lavados cobrados que tuvo asignados en el rango.',
  commissions:
    'Lo que hay que pagarle al equipo por los lavados cobrados en el rango. Es la comisión que quedó fija al cobrar.',
  commission:
    'Lo que hay que pagarle por sus lavados cobrados en el rango. Es la comisión que quedó fija al cobrar.',
  salesAttributed: 'La suma de lo cobrado en sus lavados. Sobre esto se calcula la comisión.',
  avgTime:
    'Cuánto tarda un lavado desde «Lavando» hasta «Listo». Los que la oficina pasó a Listo sin marcar «Lavando» no cuentan.',
  withExtras:
    'Cuántos lavados llevaron algo más que el lavado: tapicería, pulidos o chasis. Sirve para ver quién ofrece servicios.',
  extrasTotal: 'Lo que se cobró solo por los extras, sin contar el lavado.',
  topExtra: 'El extra que más veces se vendió en el rango.',
  loyal:
    'De los carros lavados, cuántos regresaron en los 30 días siguientes, con cualquier empleado. Sirve para ver si el cliente quedó contento.',
  returnDays:
    'Cuántos días pasan, en promedio, entre un lavado y la siguiente visita del mismo carro.',
  timeVsTeam:
    'Cuántos minutos más rápido o más lento lava que el promedio del equipo, comparando siempre el mismo tipo de carro.',
  washVsTeam:
    'Cuántos minutos más rápido o más lento fue este lavado que el promedio del equipo para ese tipo de carro.',
  extrasShare:
    'De sus lavados, qué parte llevó algo más que el lavado: tapicería, pulidos o chasis.',
  loyalShare: 'De los carros que lavó, qué parte regresó en los 30 días siguientes.',
  measured: 'Sus lavados que ya cumplieron 30 días: de esos ya se sabe si el carro volvió o no.',
} as const;

export function bodyTypeHelp(bodyTypeName: string): string {
  return `Cuánto tarda en promedio un lavado de ${bodyTypeName.toLowerCase()}, desde «Lavando» hasta «Listo».`;
}

export const NO_WASHES_TEAM = {
  title: 'Sin lavados en este rango',
  description: 'Cuando se cobren lavados en estas fechas, acá aparece cómo le fue a cada empleado.',
} as const;

export function noWashesForEmployee(fullName: string): { title: string; description: string } {
  return {
    title: `${fullName} no tiene lavados en este rango`,
    description:
      'Cuando cobre lavados en estas fechas, acá aparecen su comisión, sus tiempos, sus extras y sus clientes fieles.',
  };
}

/**
 * Las rejillas de cifras. En `bahia` las tarjetas piden más ancho y la cifra
 * sube de 32 a 38px: se lee de pie, con la tablet en la mano.
 */
const BAHIA_STAT_BOX = '[[data-density=bahia]_&]:px-card [[data-density=bahia]_&]:py-5';
const BAHIA_STAT_FIGURE =
  '[[data-density=bahia]_&]:[&_[data-slot=stat-card-value]]:text-(length:--stat-size-lg)';
/** Una cifra que es un nombre: más chica, y parte línea en vez de desbordar. */
const TEXT_FIGURE = cn(
  '[&_[data-slot=stat-card-value]]:text-(length:--stat-name-size) [&_[data-slot=stat-card-value]]:leading-tight [&_[data-slot=stat-card-value]]:whitespace-normal',
);

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3 [[data-density=bahia]_&]:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
      {children}
    </div>
  );
}

/**
 * Resumen: tres cifras arriba y dos medidores abajo, nunca una huérfana. Bajo
 * 1100px quedan de a dos con la tercera a lo ancho; en teléfono, una columna.
 */
export function SummaryGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 min-table:grid-cols-6',
        'min-table:[&>[data-span=figure]]:col-span-2 min-table:[&>[data-span=gauge]]:col-span-3',
        'sm:[&>[data-span=figure]:nth-child(3)]:col-span-2 min-table:[&>[data-span=figure]:nth-child(3)]:col-span-2',
      )}
    >
      {children}
    </div>
  );
}

/** Una cifra: rótulo con su ayuda, la cifra y la línea de apoyo. */
export function FigureStat({
  label,
  help,
  value,
  unit,
  detail,
  text = false,
}: {
  label: string;
  help: string;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  /** La cifra es un nombre («Pulido de silvines»): va más chica y parte línea. */
  text?: boolean;
}) {
  return (
    <StatCard
      data-span="figure"
      label={label}
      help={help}
      value={value}
      unit={unit}
      detail={detail}
      className={cn(BAHIA_STAT_BOX, text ? TEXT_FIGURE : BAHIA_STAT_FIGURE)}
    />
  );
}

/**
 * Un «X de Y» con su medidor: el porcentaje grande, «X de Y» al lado y el arco
 * a la derecha. El medidor es solo para esto (DESIGN.md → Medidor).
 */
export function GaugeStat({
  label,
  help,
  value,
  of,
  detail,
}: {
  label: string;
  help: string;
  value: number;
  of: number;
  detail?: ReactNode;
}) {
  const share = percent(value, of);

  return (
    <StatCard
      data-span="gauge"
      label={label}
      help={help}
      value={share === null ? '—' : `${share}%`}
      unit={`${value} de ${of}`}
      detail={detail}
      className={cn(BAHIA_STAT_BOX, BAHIA_STAT_FIGURE)}
    >
      <SegmentGauge
        value={value}
        max={of}
        label={label}
        className="[&_svg]:h-auto [&_svg]:w-full [[data-density=bahia]_&]:w-28"
      />
    </StatCard>
  );
}

/** Una tarjeta de sección: título, un aparte a la derecha y el contenido. */
export function PerformanceCard({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-line-soft bg-surface flex min-w-0 flex-col gap-3.5 rounded-card border px-5 py-4.5 max-sm:px-4">
      <div className="border-line-soft flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b pb-3">
        <h2 className="text-text text-title">{title}</h2>
        {aside === undefined ? null : <div className="ml-auto">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Texto de apoyo: sube de 12.5 a 14.5px en la bahía. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-text-dim text-dense [[data-density=bahia]_&]:text-body', className)}>
      {children}
    </p>
  );
}

/** Aviso informativo azul (`.tint` sobre `--info-text`), como el de la nota del lavado. */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <p className="tint text-info-text rounded-row border px-3.5 py-2.5">
      <b className="font-semibold">{title}</b> <span className="text-text">{children}</span>
    </p>
  );
}

const TONE_CLASS: Record<DeltaTone, string> = {
  go: 'text-go-text',
  warn: 'text-warn-text',
  neutral: 'text-text-dim',
};

/** Una comparación: la palabra siempre, el color la acompaña. */
export function Toned({ delta }: { delta: Delta }) {
  if (delta.text === '') return null;

  return <span className={TONE_CLASS[delta.tone]}>{delta.text}</span>;
}

export function EmployeeName({ fullName }: { fullName: string }) {
  return <span className="text-text font-semibold">{fullName}</span>;
}

/** `40%` con «8 de 20» debajo, o `—` sin base. */
export function PercentOf({ part, whole }: { part: number; whole: number }) {
  const share = percent(part, whole);
  if (share === null) return <span className="text-text-faint">—</span>;

  return (
    <span className="inline-flex flex-col items-end">
      <span>{share}%</span>
      <span className="text-text-faint text-label font-normal">
        {part} de {whole}
      </span>
    </span>
  );
}

/** Un extra vendido, como chip sin punto: no es un estado. */
export function ExtraChip({ children }: { children: ReactNode }) {
  return (
    <span className="border-line bg-surface-2 text-text-dim rounded-full border px-2 py-px text-label font-semibold whitespace-nowrap">
      {children}
    </span>
  );
}

/** Cargando o falló, en el mismo sitio y con la misma piel que la lista. */
export function PanelStatus({ error }: { error?: string | null }) {
  if (error) {
    return (
      <p
        role="alert"
        className="border-line-soft bg-surface text-danger-text rounded-row border px-4.5 py-4 text-body"
      >
        {error}
      </p>
    );
  }

  return (
    <p
      role="status"
      className="border-line-soft bg-surface text-text-dim rounded-row border px-4.5 py-4 text-body"
    >
      Cargando…
    </p>
  );
}
