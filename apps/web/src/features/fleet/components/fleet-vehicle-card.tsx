'use client';

import { fleetVehicleName } from '@elite/shared';
import type { FleetVehicle, FleetVehicleActivity } from '@elite/shared';
import { AlertTriangle, CalendarClock, Clock } from 'lucide-react';
import Link from 'next/link';

import { PlateChip } from '@/components/ui/plate-chip';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { fleetActivityLine } from '../fleet-activity';
import { FleetAlertList } from './fleet-alert-list';
import { FleetAvailabilityStamp } from './fleet-availability-stamp';
import { FleetCarImage } from './fleet-car-image';

/**
 * La tarjeta del garaje (115, 121): el carro en 3D con su estado, el nombre,
 * la placa, qué está pasando, los avisos y la tarifa. Toda la tarjeta abre la
 * ficha.
 */
export function FleetVehicleCard({ vehicle }: { vehicle: FleetVehicle }) {
  const line = fleetActivityLine(vehicle);

  return (
    <Link
      href={`/rentals/fleet/${vehicle.id}`}
      className={cn(
        'border-line-soft bg-surface flex flex-col overflow-hidden rounded-card border',
        'hover:border-line transition-[border-color] duration-(--duration-state) ease-standard',
      )}
    >
      <div className="bg-surface-2 relative h-(--stage-h) overflow-hidden">
        <span className="absolute top-3 right-3 z-1">
          <FleetAvailabilityStamp availability={vehicle.availability} />
        </span>
        <FleetCarImage
          vehicle={vehicle}
          className="absolute top-9 left-3.5 h-[calc(100%-2.75rem)] w-[calc(100%-1.75rem)]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 [[data-density=bahia]_&]:gap-3 [[data-density=bahia]_&]:p-5">
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="font-display text-text min-w-0 text-(length:--stat-name-size) leading-tight font-bold italic">
            {fleetVehicleName(vehicle)}
          </h3>
          {vehicle.plate === null ? (
            <span className="text-text-faint text-dense shrink-0">Sin placa</span>
          ) : (
            <PlateChip plate={vehicle.plate} size="sm" className="shrink-0" />
          )}
        </div>

        {line === null || vehicle.activity === null ? null : (
          <p className="text-text-dim text-dense [[data-density=bahia]_&]:text-body flex items-start gap-2">
            <ActivityIcon
              overdue={vehicle.availability === 'OVERDUE'}
              activity={vehicle.activity}
            />
            <span>
              {line.lead} <span className="text-text font-semibold">{line.when}</span>
              {line.customer === null ? null : ` · ${line.customer}`}
            </span>
          </p>
        )}

        <FleetAlertList alerts={vehicle.alerts} />

        <p className="font-display text-text mt-auto pt-1 text-(length:--stat-name-size) leading-none font-bold italic tabular-nums">
          {formatMoney(vehicle.dailyRate)}
          <span className="text-text-dim font-sans text-dense ml-1 font-medium not-italic">
            /día
          </span>
        </p>
      </div>
    </Link>
  );
}

function ActivityIcon({ overdue, activity }: { overdue: boolean; activity: FleetVehicleActivity }) {
  const className = 'mt-0.5 size-icon shrink-0';

  if (overdue) {
    return (
      <AlertTriangle className={cn(className, 'text-danger-text')} strokeWidth={1.5} aria-hidden />
    );
  }
  if (activity.kind === 'PICKUP') {
    return (
      <CalendarClock className={cn(className, 'text-text-faint')} strokeWidth={1.5} aria-hidden />
    );
  }

  return <Clock className={cn(className, 'text-text-faint')} strokeWidth={1.5} aria-hidden />;
}
