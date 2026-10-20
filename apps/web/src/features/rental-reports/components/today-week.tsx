'use client';

import type { CalendarRow } from '@elite/shared';

import { Skeleton } from '@/components/ui/skeleton';
import type { CivilDate } from '@/lib/civil-date';
import { cn } from '@/lib/utils';
import { occupancyRatio, slotsOf, weekOccupancy } from '../today-home';

const WEEK =
  'grid grid-cols-7 gap-2.5 max-md:flex max-md:snap-x max-md:overflow-x-auto max-md:pb-1 [[data-density=bahia]_&]:flex [[data-density=bahia]_&]:snap-x [[data-density=bahia]_&]:overflow-x-auto [[data-density=bahia]_&]:pb-1';

const DAY =
  'bg-surface border-line-soft min-w-0 rounded-row border px-3.5 py-3 max-md:w-32 max-md:shrink-0 max-md:snap-start [[data-density=bahia]_&]:w-32 [[data-density=bahia]_&]:shrink-0 [[data-density=bahia]_&]:snap-start [[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:py-3.5';

/** «Próximos 7 días» (125): ocupados sobre carros activos, hoy con borde de acento. */
export function TodayWeek({
  rows,
  active,
  isLoading,
  errorMessage,
  today,
}: {
  rows: readonly CalendarRow[] | null;
  active: number;
  isLoading: boolean;
  errorMessage: string | null;
  today: CivilDate;
}) {
  const days = rows === null ? [] : weekOccupancy(slotsOf(rows), today);

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-title text-text">Próximos 7 días</h2>
      {isLoading ? (
        <div className={WEEK} role="status" aria-label="Cargando la semana">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className={cn(DAY, 'h-20 border-0')} />
          ))}
        </div>
      ) : errorMessage !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {errorMessage}
        </p>
      ) : (
        <div className={WEEK}>
          {days.map((day) => {
            const width = Math.round(occupancyRatio(day.occupied, active) * 100);

            return (
              <div key={day.date} className={cn(DAY, day.date === today && 'border-flame')}>
                <p className="text-text-dim text-dense font-medium">{day.label}</p>
                <p className="font-display text-text mt-1 text-(length:--stat-size) leading-none font-bold whitespace-nowrap italic tabular-nums">
                  {day.occupied}
                  <span className="text-text-faint font-sans text-dense font-medium not-italic">
                    /{active}
                  </span>
                </p>
                <div aria-hidden className="bg-surface-3 mt-2.5 h-1 overflow-hidden rounded-sm">
                  <div
                    className="h-full rounded-sm [background-image:var(--gradient-bar-active)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
