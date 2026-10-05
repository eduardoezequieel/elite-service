'use client';

import { PERMISSIONS } from '@elite/shared';
import type { CalendarRow } from '@elite/shared';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { FilterChip } from '@/components/ui/filter-chip';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { WEEKDAYS, parseCivil, todayCivil, type CivilDate } from '@/lib/civil-date';
import {
  dailyPriceLabel,
  dayOccupants,
  defaultFreeRange,
  pushReturn,
  weekDays,
  weekRange,
  weekendRange,
  type FreeRange,
} from '../available-range';
import { fieldToInstant } from '../datetime';
import { useAvailability, useCalendar } from '../hooks/use-agreements';
import { DateTimeField } from './rental-fields';

/**
 * Libre (107): dos fechas, los carros libres con el precio, y la semana.
 * La disponibilidad y el calendario llegan del API tal como están.
 */

export function AvailableScreen() {
  const [today] = useState(() => todayCivil());
  const initial = defaultFreeRange(today);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [showWeek, setShowWeek] = useState(false);
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);

  const fromAt = fieldToInstant(from);
  const toAt = fieldToInstant(to);
  const valid = fromAt !== null && toAt !== null && Date.parse(toAt) > Date.parse(fromAt);
  const availability = useAvailability(valid ? { from: fromAt, to: toAt } : null);

  const presets: { label: string; range: FreeRange }[] = [
    { label: 'Mañana', range: defaultFreeRange(today) },
    { label: 'Fin de semana', range: weekendRange(today) },
    { label: 'Una semana', range: weekRange(today) },
  ];

  const free = (availability.data ?? [])
    .filter((row) => row.availability === 'FREE')
    .sort((left, right) => {
      const rate = Number(left.dailyRate) - Number(right.dailyRate);
      if (rate !== 0) return rate;

      return (left.vehicle.plate ?? '').localeCompare(right.vehicle.plate ?? '', 'es');
    });

  return (
    <div>
      <ScreenHeader title="Libre" />

      <div className="grid gap-3 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <DateTimeField
          id="free-from"
          label="Sale"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <DateTimeField
          id="free-to"
          label="Regresa"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>

      <div className="mt-3 mb-4 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <FilterChip
            key={preset.label}
            pressed={from === preset.range.from && to === preset.range.to}
            onClick={() => {
              setFrom(preset.range.from);
              setTo(preset.range.to);
            }}
          >
            {preset.label}
          </FilterChip>
        ))}
        <FilterChip pressed={showWeek} onClick={() => setShowWeek((value) => !value)}>
          Ver la semana
        </FilterChip>
      </div>

      {valid ? null : (
        <p className="text-danger-text text-body" role="alert">
          Revisá las fechas
        </p>
      )}

      {!valid ? null : availability.isPending ? (
        <ListSkeleton rows={4} label="Cargando lo libre" />
      ) : availability.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {availability.error.message}
        </p>
      ) : free.length === 0 ? (
        <p className="text-text-dim text-body">Nada libre</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 [[data-density=bahia]_&]:grid-cols-1">
          {free.map((row) => (
            <article
              key={row.vehicle.id}
              className="border-line bg-surface flex flex-col gap-3 rounded-row border p-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                {row.vehicle.plate === null ? null : (
                  <PlateChip plate={row.vehicle.plate} size="sm" />
                )}
                <h2 className="text-body truncate font-semibold">
                  {row.vehicle.make} {row.vehicle.model}
                </h2>
              </div>
              <p className="text-text text-dense tabular-nums">
                {dailyPriceLabel(row.dailyRate, row.billableDays, row.estimatedTotal)}
              </p>
              {canManage ? (
                <Button asChild variant="outline">
                  <Link
                    href={`/rentals/agreements/new?vehicleId=${row.vehicle.id}&from=${encodeURIComponent(fromAt)}&to=${encodeURIComponent(toAt)}`}
                  >
                    Reservar
                  </Link>
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {showWeek ? (
        <WeekGrid
          from={from}
          onPick={(day) => {
            const nextFrom = `${day}T09:00`;
            setTo(pushReturn(nextFrom, to));
            setFrom(nextFrom);
            setShowWeek(false);
          }}
        />
      ) : null}
    </div>
  );
}

function WeekGrid({ from, onPick }: { from: string; onPick: (day: CivilDate) => void }) {
  const days = weekDays(from);
  const calendar = useCalendar(days[0] ?? '', days[6] ?? '', days.length === 7);

  if (days.length === 0) return null;
  if (calendar.isPending) return <ListSkeleton rows={4} label="Cargando la semana" />;
  if (calendar.error !== null) {
    return (
      <p className="text-danger-text text-body mt-4" role="alert">
        {calendar.error.message}
      </p>
    );
  }

  return (
    <div className="border-line-soft bg-surface mt-6 overflow-x-auto rounded-row border">
      <div role="grid" aria-label="Semana" className="flex min-w-max flex-col">
        <div role="row" className="border-line bg-surface-2 flex border-b">
          <div role="columnheader" className="text-text-faint w-36 shrink-0 px-3 py-2 text-label">
            Carro
          </div>
          {days.map((day) => (
            <div
              key={day}
              role="columnheader"
              className="text-text-faint flex w-24 shrink-0 flex-col items-center py-2 text-label tabular-nums"
            >
              <span>{WEEKDAYS[(parseCivil(day).getUTCDay() + 6) % 7]}</span>
              <span className="text-dense">{Number(day.slice(8))}</span>
            </div>
          ))}
        </div>
        {calendar.data.map((row) => (
          <WeekRow key={row.vehicle.id} row={row} days={days} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  row,
  days,
  onPick,
}: {
  row: CalendarRow;
  days: readonly CivilDate[];
  onPick: (day: CivilDate) => void;
}) {
  const workshop = row.vehicle.status === 'IN_SHOP';

  return (
    <div role="row" className="border-line-soft flex border-b last:border-b-0">
      <div role="rowheader" className="flex w-36 shrink-0 flex-col justify-center gap-1 px-3 py-2">
        {row.vehicle.plate === null ? null : <PlateChip plate={row.vehicle.plate} size="sm" />}
        <span className="text-text-dim truncate text-dense">
          {row.vehicle.make} {row.vehicle.model}
        </span>
      </div>
      {days.map((day) => {
        if (workshop) {
          return (
            <div
              key={day}
              role="gridcell"
              className="text-warn-text flex w-24 shrink-0 items-center justify-center px-1 text-dense"
            >
              Taller
            </div>
          );
        }

        const occupants = dayOccupants(row.agreements, day);
        if (occupants !== '') {
          return (
            <div
              key={day}
              role="gridcell"
              className="text-text flex w-24 shrink-0 items-center justify-center px-1 text-center text-dense"
            >
              {occupants}
            </div>
          );
        }

        return (
          <div key={day} role="gridcell" className="flex w-24 shrink-0 items-stretch p-1">
            <button
              type="button"
              onClick={() => onPick(day)}
              className="text-go-text hover:bg-surface-2 min-h-(--touch-min) w-full rounded-control text-dense font-semibold"
            >
              Libre
            </button>
          </div>
        );
      })}
    </div>
  );
}
