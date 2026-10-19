'use client';

import { FLEET_CATEGORY_LABELS, PERMISSIONS, fleetVehicleName } from '@elite/shared';
import type { AvailabilityRow } from '@elite/shared';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DateRangeField } from '@/components/ui/date-field';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FleetAvailabilityStamp } from '@/features/fleet/components/fleet-availability-stamp';
import { FleetCarImage } from '@/features/fleet/components/fleet-car-image';
import { formatMoney } from '@/lib/money';
import { todayCivil } from '@/lib/civil-date';
import { defaultFreeRange, fromCivilRange, rangeLabel, toCivilRange } from '../available-range';
import { fieldToInstant } from '../datetime';
import { useAvailability } from '../hooks/use-agreements';

/**
 * Libre (107, 117): el rango en el calendario de siempre, sin atajos, y los
 * carros libres con el precio. La cabecera y los tabs los pone `RentalsFrame`.
 * La disponibilidad llega del API tal como está.
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

  const free = (availability.data ?? [])
    .filter((row) => row.availability === 'FREE')
    .sort((left, right) => {
      const rate = Number(left.dailyRate) - Number(right.dailyRate);
      if (rate !== 0) return rate;

      return (left.vehicle.plate ?? '').localeCompare(right.vehicle.plate ?? '', 'es');
    });

  return (
    <div>
      <div className="mb-5 flex">
        <DateRangeField
          value={toCivilRange({ from, to })}
          triggerLabel={rangeLabel({ from, to })}
          presets={[]}
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
          Revise las fechas
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
