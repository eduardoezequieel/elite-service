'use client';

import { FLEET_CATEGORY_LABELS, fleetVehicleName } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';
import { AlertTriangle, CalendarClock, Check, Clock, FileText, Wrench } from 'lucide-react';
import Link from 'next/link';

import { PlateChip } from '@/components/ui/plate-chip';
import { Reference } from '@/components/ui/reference';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { fleetActivityLine } from '../fleet-activity';
import { FleetAvailabilityStamp } from './fleet-availability-stamp';
import { FleetCarImage } from './fleet-car-image';

/**
 * La tarjeta del garaje (115): el carro en 3D, su estado, qué está pasando y la
 * tarifa. Toda la tarjeta abre la ficha.
 */
export function FleetVehicleCard({
  vehicle,
  reference,
}: {
  vehicle: FleetVehicle;
  reference: number;
}) {
  const line = fleetActivityLine(vehicle);
  const subtitle = [vehicle.year, FLEET_CATEGORY_LABELS[vehicle.category]]
    .filter((part) => part !== null)
    .join(' · ');

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

        {line === null ? null : (
          <p className="text-text-dim text-dense [[data-density=bahia]_&]:text-body flex items-start gap-2">
            <ActivityIcon vehicle={vehicle} />
            <span>
              {line.lead}
              {line.when === null ? null : (
                <>
                  {' '}
                  <span className="text-text font-semibold">{line.when}</span>
                </>
              )}
              {line.customer === null ? null : ` · ${line.customer}`}
            </span>
          </p>
        )}

        {vehicle.alerts.length === 0 ? null : (
          <ul className="flex flex-col gap-1">
            {vehicle.alerts.map((alert) => (
              <li
                key={`${alert.kind}:${alert.text}`}
                className={cn(
                  'text-label [[data-density=bahia]_&]:text-dense flex items-start gap-1.5',
                  alert.level === 'DUE' ? 'text-danger-text' : 'text-warn-text',
                )}
              >
                {alert.level === 'DUE' ? (
                  <AlertTriangle
                    className="mt-px size-3.5 shrink-0"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                ) : (
                  <FileText className="mt-px size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                )}
                {alert.text}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-2.5 pt-1">
          <span className="font-display text-text text-(length:--stat-name-size) leading-none font-bold italic tabular-nums">
            {formatMoney(vehicle.dailyRate)}
            <span className="text-text-dim font-sans text-dense ml-1 font-medium not-italic">
              /día
            </span>
          </span>
          <Reference value={reference} className="text-text-faint" />
        </div>
      </div>
    </Link>
  );
}

function ActivityIcon({ vehicle }: { vehicle: FleetVehicle }) {
  const className = 'mt-0.5 size-icon shrink-0';

  if (vehicle.availability === 'OVERDUE') {
    return (
      <AlertTriangle className={cn(className, 'text-danger-text')} strokeWidth={1.5} aria-hidden />
    );
  }
  if (vehicle.availability === 'WORKSHOP') {
    return <Wrench className={cn(className, 'text-warn-text')} strokeWidth={1.5} aria-hidden />;
  }
  if (vehicle.activity === null) {
    return <Check className={cn(className, 'text-go-text')} strokeWidth={1.5} aria-hidden />;
  }
  if (vehicle.activity.kind === 'PICKUP') {
    return (
      <CalendarClock className={cn(className, 'text-text-faint')} strokeWidth={1.5} aria-hidden />
    );
  }

  return <Clock className={cn(className, 'text-text-faint')} strokeWidth={1.5} aria-hidden />;
}
