'use client';

import { FLEET_CATEGORY_LABELS, PERMISSIONS, fleetVehicleName } from '@elite/shared';
import type { AvailabilityRow, CalendarRow } from '@elite/shared';
import Link from 'next/link';
import { useState } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DateRangeField } from '@/components/ui/date-field';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FleetAvailabilityStamp } from '@/features/fleet/components/fleet-availability-stamp';
import { FleetCarImage } from '@/features/fleet/components/fleet-car-image';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { WEEKDAYS, parseCivil, todayCivil, type CivilDate } from '@/lib/civil-date';
import {
  dayOccupancy,
  defaultFreeRange,
  pushReturn,
  fromCivilRange,
  rangeLabel,
  toCivilRange,
  weekDays,
  weekRange,
  weekendRange,
  type FreeRange,
} from '../available-range';
import { fieldToInstant } from '../datetime';
import { useAvailability, useCalendar } from '../hooks/use-agreements';

/**
 * Libre (107): el rango en el calendario de siempre, los carros libres con el
 * precio, y la semana.
 * La disponibilidad y el calendario llegan del API tal como están.
 */

export function AvailableScreen() {
  const [today] = useState(() => todayCivil());
  const initial = defaultFreeRange(today);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
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

      <div className="mb-5 flex">
        <DateRangeField
          value={toCivilRange({ from, to })}
          triggerLabel={rangeLabel({ from, to })}
          presets={presets.map((preset) => ({
            label: preset.label,
            range: toCivilRange(preset.range),
          }))}
          onChange={(range) => {
            const next = fromCivilRange(range);
            setFrom(next.from);
            setTo(next.to);
          }}
          aria-label="Fechas"
        />
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
        <section aria-label="Libre" className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2.5">
            <FleetAvailabilityStamp availability="FREE" />
            <span className="font-display text-text-dim text-(length:--gauge-size) leading-none font-bold italic tabular-nums">
              {free.length}
            </span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(var(--card-min),100%),1fr))] gap-3.5">
            {free.map((row) => (
              <FreeCard
                key={row.vehicle.id}
                row={row}
                reserveHref={
                  canManage
                    ? `/rentals/agreements/new?vehicleId=${row.vehicle.id}&from=${encodeURIComponent(fromAt)}&to=${encodeURIComponent(toAt)}`
                    : null
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-body mb-3 font-semibold">Semana</h2>
        <WeekGrid
          from={from}
          to={to}
          onPick={(day) => {
            const nextFrom = `${day}T09:00`;
            setTo(pushReturn(nextFrom, to));
            setFrom(nextFrom);
          }}
        />
      </section>
    </div>
  );
}

/** La tarjeta de Carros (115) con lo que cuesta el rango y «Reservar». */
function FreeCard({ row, reserveHref }: { row: AvailabilityRow; reserveHref: string | null }) {
  const { vehicle } = row;
  const subtitle = [vehicle.year, FLEET_CATEGORY_LABELS[vehicle.category]]
    .filter((part) => part !== null)
    .join(' · ');
  const days = `${row.billableDays} ${row.billableDays === 1 ? 'día' : 'días'}`;

  return (
    <article className="border-line-soft bg-surface flex flex-col overflow-hidden rounded-card border">
      <div className="bg-surface-2 relative h-(--stage-h) overflow-hidden">
        <FleetCarImage
          vehicle={vehicle}
          className="absolute top-9 left-3.5 h-[calc(100%-2.75rem)] w-[calc(100%-1.75rem)]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 [[data-density=bahia]_&]:gap-3 [[data-density=bahia]_&]:p-5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="font-display text-text text-(length:--stat-name-size) leading-tight font-bold italic">
              {fleetVehicleName(vehicle)}
            </h3>
            <p className="text-text-dim text-dense [[data-density=bahia]_&]:text-body mt-0.5">
              {subtitle}
            </p>
          </div>
          {vehicle.plate === null ? (
            <span className="text-text-faint text-dense shrink-0">Sin placa</span>
          ) : (
            <PlateChip plate={vehicle.plate} size="sm" className="shrink-0" />
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2.5 pt-1">
          <span className="font-display text-text text-(length:--stat-name-size) leading-none font-bold italic tabular-nums">
            {formatMoney(row.dailyRate)}
            <span className="text-text-dim font-sans text-dense ml-1 font-medium not-italic">
              /día
            </span>
          </span>
          <span className="text-text-dim text-dense [[data-density=bahia]_&]:text-body tabular-nums">
            {days} ·{' '}
            <span className="text-text font-semibold">{formatMoney(row.estimatedTotal)}</span>
          </span>
        </div>

        {reserveHref === null ? null : (
          <Button asChild variant="outline">
            <Link href={reserveHref}>Reservar</Link>
          </Button>
        )}
      </div>
    </article>
  );
}

function WeekGrid({
  from,
  to,
  onPick,
}: {
  from: string;
  to: string;
  onPick: (day: CivilDate) => void;
}) {
  const days = weekDays(from);
  const calendar = useCalendar(days[0] ?? '', days[6] ?? '', days.length === 7);

  const today = todayCivil();
  if (days.length === 0) return null;
  if (calendar.isPending) return <ListSkeleton rows={4} label="Cargando la semana" />;
  if (calendar.error !== null) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {calendar.error.message}
      </p>
    );
  }

  return (
    <div className="border-line-soft bg-surface overflow-x-auto rounded-row border">
      <div role="grid" aria-label="Semana" className="flex min-w-max flex-col">
        <div role="row" className="border-line bg-surface-2 flex border-b">
          <div role="columnheader" className="text-text-faint w-36 shrink-0 px-3 py-2 text-label">
            Carro
          </div>
          {days.map((day) => (
            <div
              key={day}
              role="columnheader"
              className={cn(
                'flex w-24 shrink-0 grow flex-col items-center py-2 text-label tabular-nums',
                day >= from.slice(0, 10) && day < to.slice(0, 10)
                  ? 'text-flame-text bg-flame/10 font-semibold'
                  : 'text-text-faint',
              )}
            >
              <span>{WEEKDAYS[(parseCivil(day).getUTCDay() + 6) % 7]}</span>
              <span className="text-dense">{Number(day.slice(8))}</span>
            </div>
          ))}
        </div>
        {calendar.data.map((row) => (
          <WeekRow key={row.vehicle.id} row={row} days={days} today={today} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  row,
  days,
  today,
  onPick,
}: {
  row: CalendarRow;
  days: readonly CivilDate[];
  today: CivilDate;
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
              className="text-warn-text flex w-24 shrink-0 grow items-center justify-center px-1 text-dense"
            >
              Taller
            </div>
          );
        }

        const occupants = dayOccupancy(row.agreements, day);
        if (occupants !== null) {
          return (
            <div key={day} role="gridcell" className="flex w-24 shrink-0 grow items-stretch p-1">
              <OriginLink
                href={`/rentals/agreements/${occupants.agreementId}`}
                className="text-text hover:bg-surface-2 flex min-h-(--touch-min) w-full items-center justify-center rounded-control px-1 text-center text-dense"
              >
                {occupants.label}
              </OriginLink>
            </div>
          );
        }

        if (day < today) {
          return (
            <div
              key={day}
              role="gridcell"
              className="text-text-faint flex w-24 shrink-0 grow items-center justify-center px-1 text-dense"
            >
              —
            </div>
          );
        }

        return (
          <div key={day} role="gridcell" className="flex w-24 shrink-0 grow items-stretch p-1">
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
