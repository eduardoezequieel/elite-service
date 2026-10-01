'use client';

import { AGREEMENT_STATUS_LABELS, PERMISSIONS } from '@elite/shared';
import type { AgreementDerivedStatus, AgreementSlot, CalendarRow } from '@elite/shared';
import { CalendarDays as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useDensity } from '@/components/density-provider';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { WEEKDAYS, addDays, parseCivil, todayCivil, type CivilDate } from '@/lib/civil-date';
import { cn } from '@/lib/utils';
import { calendarDays, slotPlacement, vehicleTitle } from '../agreement-format';
import { useCalendar } from '../hooks/use-agreements';
import { AGREEMENT_STATUS_TEXT, AgreementStatusStamp } from './agreement-status-stamp';

const WEEK_OPTIONS = [1, 2, 3, 4].map((weeks) => ({
  value: String(weeks),
  label: weeks === 1 ? '1 semana' : `${weeks} semanas`,
}));

const LEGEND: AgreementDerivedStatus[] = ['RESERVED', 'IN_PROGRESS', 'LATE', 'FINISHED'];

/** Celda de día: ancho fijo en escritorio; en `bahia` los 7 días reparten el ancho. */
const DAY_CELL =
  'w-14 shrink-0 [[data-density=bahia]_&]:w-auto [[data-density=bahia]_&]:min-w-12 [[data-density=bahia]_&]:flex-1';
const VEHICLE_CELL =
  'bg-surface border-line-soft sticky left-0 z-10 flex w-44 shrink-0 flex-col justify-center gap-1 border-r px-3 py-2 max-sm:w-32';

function weekdayOf(civil: CivilDate): string {
  return WEEKDAYS[(parseCivil(civil).getUTCDay() + 6) % 7] ?? '';
}

/**
 * Calendario de la flota (096): una fila por carro, una columna por día, de 1
 * a 4 semanas (7 días en `bahia`). Cada renta es una barra con el nombre del
 * cliente y su estado escrito; tocarla abre el detalle y tocar un hueco abre
 * «Nueva renta» con el carro y el día prellenados.
 */
export function CalendarScreen() {
  const router = useRouter();
  const { density } = useDensity();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const today = todayCivil();
  const [start, setStart] = useState<CivilDate>(today);
  const [weeks, setWeeks] = useState('2');
  const count = density === 'bahia' ? 7 : Number(weeks) * 7;
  const days = calendarDays(start, count);
  const end = days[days.length - 1] ?? start;
  const calendar = useCalendar(start, end);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Calendario" subtitle="Quién tiene cada carro, día por día.">
        {canManage ? (
          <Button asChild>
            <OriginLink href="/rentals/agreements/new">Nueva renta</OriginLink>
          </Button>
        ) : null}
      </ScreenHeader>

      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setStart(addDays(start, -count))}
          >
            <ChevronLeft className="size-icon" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Antes</span>
          </Button>
          <Button type="button" variant="outline" onClick={() => setStart(today)}>
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setStart(addDays(start, count))}
          >
            <ChevronRight className="size-icon" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Después</span>
          </Button>
        </div>
        {density === 'bahia' ? null : (
          <Combobox
            id="calendar-weeks"
            label="Mostrar"
            className="w-44"
            options={WEEK_OPTIONS}
            value={weeks}
            onChange={setWeeks}
          />
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {LEGEND.map((status) => (
            <AgreementStatusStamp key={status} status={status} />
          ))}
        </div>
      </div>

      {calendar.isPending ? (
        <ListSkeleton rows={5} />
      ) : calendar.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {calendar.error.message}
        </p>
      ) : calendar.data.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="Todavía no hay flota"
          description="Los carros aparecen acá cuando se cargan en Flota."
        />
      ) : (
        <div className="border-line-soft bg-surface overflow-x-auto rounded-row border">
          <div
            role="grid"
            aria-label={`Calendario del ${days[0] ?? ''} al ${end}`}
            className="flex min-w-max flex-col [[data-density=bahia]_&]:min-w-full"
          >
            <div role="row" className="border-line bg-surface-2 flex border-b">
              <div
                role="columnheader"
                className={cn(VEHICLE_CELL, 'bg-surface-2 text-label text-text-faint')}
              >
                Carro
              </div>
              {days.map((day) => (
                <div
                  key={day}
                  role="columnheader"
                  aria-current={day === today ? 'date' : undefined}
                  className={cn(
                    DAY_CELL,
                    'flex flex-col items-center justify-center py-1.5 text-label tabular-nums',
                    day === today ? 'text-flame-text font-bold' : 'text-text-faint',
                  )}
                >
                  <span>{day === today ? 'Hoy' : weekdayOf(day)}</span>
                  <span className="text-dense">{Number(day.slice(8))}</span>
                </div>
              ))}
            </div>

            {calendar.data.map((row) => (
              <CalendarLine
                key={row.vehicle.id}
                row={row}
                days={days}
                today={today}
                onGap={
                  canManage
                    ? (day) =>
                        router.push(
                          `/rentals/agreements/new?vehicleId=${row.vehicle.id}&from=${day}`,
                        )
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarLine({
  row,
  days,
  today,
  onGap,
}: {
  row: CalendarRow;
  days: readonly CivilDate[];
  today: CivilDate;
  onGap?: (day: CivilDate) => void;
}) {
  const name = vehicleTitle(row.vehicle);

  return (
    <div role="row" className="border-line-soft flex min-h-(--row-h) border-b last:border-b-0">
      <div role="rowheader" className={VEHICLE_CELL}>
        {row.vehicle.plate === null ? null : <PlateChip plate={row.vehicle.plate} size="sm" />}
        <span className="text-text-dim truncate text-dense">{name}</span>
      </div>

      <div className="relative flex flex-1">
        {days.map((day) =>
          onGap === undefined ? (
            <div
              key={day}
              role="gridcell"
              className={cn(DAY_CELL, 'border-line-soft border-r', day === today && 'bg-surface-2')}
            />
          ) : (
            <button
              key={day}
              type="button"
              role="gridcell"
              onClick={() => onGap(day)}
              aria-label={`Nueva renta del ${name} desde el ${day}`}
              className={cn(
                DAY_CELL,
                'border-line-soft hover:bg-surface-2 border-r transition-colors duration-(--duration-state) ease-standard',
                day === today && 'bg-surface-2',
              )}
            />
          ),
        )}

        {row.agreements.map((slot) => (
          <CalendarBar key={slot.id} slot={slot} days={days} />
        ))}
      </div>
    </div>
  );
}

function CalendarBar({ slot, days }: { slot: AgreementSlot; days: readonly CivilDate[] }) {
  const placement = slotPlacement(slot, days);
  if (placement === null) return null;

  const label = AGREEMENT_STATUS_LABELS[slot.derivedStatus];

  return (
    <div
      className="absolute inset-y-0 p-1"
      style={{
        left: `${(placement.index / days.length) * 100}%`,
        width: `${(placement.span / days.length) * 100}%`,
      }}
    >
      <OriginLink
        href={`/rentals/agreements/${slot.id}`}
        aria-label={`${slot.customerName}, ${label}`}
        className={cn(
          'tint flex size-full min-w-0 flex-col justify-center overflow-hidden border px-2 text-dense',
          AGREEMENT_STATUS_TEXT[slot.derivedStatus],
          placement.continuesBefore ? 'rounded-l-none' : 'rounded-l-control',
          placement.continuesAfter ? 'rounded-r-none' : 'rounded-r-control',
        )}
      >
        <span className="text-text truncate font-semibold">{slot.customerName}</span>
        <span className="truncate">{label}</span>
      </OriginLink>
    </div>
  );
}
