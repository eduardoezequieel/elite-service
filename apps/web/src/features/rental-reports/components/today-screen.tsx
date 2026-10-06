'use client';

import { PERMISSIONS, VEHICLE_AVAILABILITY_LABELS } from '@elite/shared';
import type { TodayRow, TodayVehicle, VehicleAvailability } from '@elite/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { timeLabel, todayCivil } from '@/lib/civil-date';
import { moneyParts } from '@/lib/money';
import { cn } from '@/lib/utils';
import { instantToCivil } from '@/features/rentals/datetime';
import { useRentalToday } from '../hooks/use-rental-reports';
import { shortCivil, todayTitle } from '../today-format';

/**
 * Hoy (107): a quién se entrega, a quién se recibe y quién debe. El estado de
 * cada carro llega hecho del API.
 */

const AVAILABILITY_TEXT: Record<VehicleAvailability, string> = {
  FREE: 'text-go-text',
  RENTED: 'text-flame-text',
  OVERDUE: 'text-danger-text',
  RESERVED: 'text-info-text',
  WORKSHOP: 'text-warn-text',
};

const BLOCKS = [
  { key: 'departures', title: 'Salen hoy', alert: false },
  { key: 'returns', title: 'Vuelven hoy', alert: false },
  { key: 'overdue', title: 'Atrasados', alert: true },
] as const;

export function TodayScreen() {
  const today = useRentalToday();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const canCharge = can(PERMISSIONS.rentals.actions.charge.key);

  return (
    <div>
      <ScreenHeader title={todayTitle(today.data?.date ?? todayCivil())}>
        {canManage ? (
          <Button asChild>
            <Link href="/rentals/agreements/new">
              <Plus aria-hidden />
              Nueva renta
            </Link>
          </Button>
        ) : null}
      </ScreenHeader>

      {today.isPending ? (
        <ListSkeleton rows={6} label="Cargando el día" />
      ) : today.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {today.error.message}
        </p>
      ) : (
        <TodayBody data={today.data} canCharge={canCharge} />
      )}
    </div>
  );
}

function TodayBody({
  data,
  canCharge,
}: {
  data: NonNullable<ReturnType<typeof useRentalToday>['data']>;
  canCharge: boolean;
}) {
  const parts = moneyParts(data.collected.total);
  const card = <StatCard label="Cobrado hoy" value={parts.whole} unit={parts.fraction} tone="go" />;

  return (
    <div className="flex flex-col gap-6">
      {canCharge ? (
        <Link href="/rentals/cash" className="block">
          {card}
        </Link>
      ) : (
        card
      )}

      <div className="grid gap-4 md:grid-cols-3 [[data-density=bahia]_&]:grid-cols-1">
        {BLOCKS.map((block) => (
          <DayBlock
            key={block.key}
            title={block.title}
            rows={data[block.key]}
            alert={block.alert}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {data.fleet.map((vehicle) => (
          <FleetChip key={vehicle.vehicleId} vehicle={vehicle} />
        ))}
      </div>
    </div>
  );
}

function DayBlock({
  title,
  rows,
  alert,
}: {
  title: string;
  rows: readonly TodayRow[];
  alert: boolean;
}) {
  const highlighted = alert && rows.length > 0;

  return (
    <section
      className={cn('bg-surface rounded-row border', highlighted ? 'border-danger' : 'border-line')}
    >
      <h2 className="border-line text-body flex items-baseline gap-2 border-b px-4 py-3 font-semibold">
        {title}
        <span
          className={cn(
            'text-dense rounded-full px-1.5 font-medium tabular-nums',
            highlighted ? 'bg-danger/15 text-danger-text' : 'text-text-faint',
          )}
        >
          {rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-text-dim text-dense px-4 py-4">Nada por hoy</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <DayRow key={`${row.kind}-${row.agreementId}`} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DayRow({ row }: { row: TodayRow }) {
  const past = Date.parse(row.at) < Date.now();
  const when = row.kind === 'OVERDUE' ? shortCivil(instantToCivil(row.at)) : timeLabel(row.at);
  const action = rowAction(row);

  return (
    <li className="border-line-soft flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <OriginLink
        href={`/rentals/agreements/${row.agreementId}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            {row.plate === '' ? null : <PlateChip plate={row.plate} size="sm" />}
            <span className="text-text truncate font-semibold">{row.vehicleName}</span>
          </span>
          <span className="text-text-dim text-dense mt-1 block truncate">{row.customerName}</span>
        </span>
        <time
          dateTime={row.at}
          className={cn(
            'text-dense shrink-0 tabular-nums',
            row.kind === 'OVERDUE' || past ? 'text-danger-text' : 'text-text',
          )}
        >
          {when}
        </time>
      </OriginLink>
      {action === null ? null : (
        <Button asChild size="sm" variant="outline">
          {action}
        </Button>
      )}
    </li>
  );
}

function rowAction(row: TodayRow) {
  if (row.kind === 'DEPARTURE') {
    return <Link href={`/rentals/agreements/${row.agreementId}?action=deliver`}>Entregar</Link>;
  }
  if (row.kind === 'RETURN') {
    return <Link href={`/rentals/agreements/${row.agreementId}?action=return`}>Recibir</Link>;
  }
  if (row.customerPhone === '') return null;

  return <a href={`tel:${row.customerPhone}`}>Llamar</a>;
}

function FleetChip({ vehicle }: { vehicle: TodayVehicle }) {
  const label = VEHICLE_AVAILABILITY_LABELS[vehicle.availability];

  return (
    <Link
      href={fleetHref(vehicle)}
      title={label}
      className={cn(
        'tint inline-flex min-h-(--touch-min) items-center rounded-sm border',
        AVAILABILITY_TEXT[vehicle.availability],
      )}
    >
      <PlateChip plate={vehicle.plate} size="sm" className="border-0 bg-transparent text-current" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}

function fleetHref(vehicle: TodayVehicle): string {
  if (vehicle.availability === 'WORKSHOP') return `/rentals/fleet/${vehicle.vehicleId}`;
  if (vehicle.agreementId !== undefined) return `/rentals/agreements/${vehicle.agreementId}`;

  return `/rentals/agreements/new?vehicleId=${vehicle.vehicleId}`;
}
