'use client';

import { PERMISSIONS } from '@elite/shared';
import type { TodayOutRow, TodayRow } from '@elite/shared';
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

/** Hoy (107, 116): salidas del día y rentas que siguen afuera. */

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

      <div className="grid gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <DayBlock title="Salen hoy" rows={data.departures} />
        <OutBlock rows={data.out} />
      </div>
    </div>
  );
}

function DayBlock({ title, rows }: { title: string; rows: readonly TodayRow[] }) {
  return (
    <section className="bg-surface rounded-row border border-line">
      <h2 className="border-line text-body flex items-baseline gap-2 border-b px-4 py-3 font-semibold">
        {title}
        <span className="text-dense text-text-faint rounded-full px-1.5 font-medium tabular-nums">
          {rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-text-dim text-dense px-4 py-4">Nada por hoy</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <DayRow key={row.agreementId} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function OutBlock({ rows }: { rows: readonly TodayOutRow[] }) {
  return (
    <section className="bg-surface rounded-row border border-line">
      <h2 className="border-line text-body flex items-baseline gap-2 border-b px-4 py-3 font-semibold">
        En la calle
        <span className="text-dense text-text-faint rounded-full px-1.5 font-medium tabular-nums">
          {rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-text-dim text-dense px-4 py-4">Nadie en la calle</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <OutRow key={row.agreementId} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DayRow({ row }: { row: TodayRow }) {
  const past = Date.parse(row.at) < Date.now();
  const when = timeLabel(row.at);

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
            past ? 'text-danger-text' : 'text-text',
          )}
        >
          {when}
        </time>
      </OriginLink>
      <Button asChild size="sm" variant="outline">
        {rowAction(row)}
      </Button>
    </li>
  );
}

function rowAction(row: TodayRow) {
  return <Link href={`/rentals/agreements/${row.agreementId}?action=deliver`}>Entregar</Link>;
}

function OutRow({ row }: { row: TodayOutRow }) {
  const action = outRowAction(row);
  const date = shortCivil(instantToCivil(row.at));
  const time = timeLabel(row.at);
  const when =
    row.returnStatus === 'TODAY'
      ? `Vuelve hoy · ${time}`
      : row.returnStatus === 'OVERDUE'
        ? `Debió volver ${date} · ${time}`
        : `Vuelve ${date} · ${time}`;

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
            row.returnStatus === 'OVERDUE' ? 'text-danger-text' : 'text-text',
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

function outRowAction(row: TodayOutRow) {
  if (row.returnStatus === 'TODAY') {
    return <Link href={`/rentals/agreements/${row.agreementId}?action=return`}>Recibir</Link>;
  }
  if (row.returnStatus === 'OVERDUE' && row.customerPhone !== '') {
    return <a href={`tel:${row.customerPhone}`}>Llamar</a>;
  }

  return null;
}
