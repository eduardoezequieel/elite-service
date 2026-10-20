'use client';

import type { FleetVehicle, RentalToday } from '@elite/shared';
import type { ReactNode } from 'react';
import Link from 'next/link';

import { OriginLink } from '@/components/app-shell/origin-link';
import { Button } from '@/components/ui/button';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { sortByAvailability } from '@/features/fleet/fleet-list';
import { instantToCivil } from '@/features/rentals/datetime';
import { timeLabel } from '@/lib/civil-date';
import { cn } from '@/lib/utils';
import { shortCivil } from '../today-format';
import {
  dueAlertPending,
  homeMoves,
  overduePending,
  type AlertPending,
  type HomeMove,
  type OverduePending,
} from '../today-home';

const PAIR = 'grid gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1';

/** «Salen y vuelven» y «Pendientes» (125). */
export function TodayLists({
  today,
  todayLoading,
  todayError,
  vehicles,
  alertsLoading,
  alertsError,
}: {
  today: RentalToday | null;
  todayLoading: boolean;
  todayError: string | null;
  /** `null` mientras la flota no llega. `[]` si no hay carros o no hay permiso. */
  vehicles: readonly FleetVehicle[] | null;
  alertsLoading: boolean;
  alertsError: string | null;
}) {
  const moves = today === null ? [] : homeMoves(today);
  const overdue = today === null ? [] : overduePending(today.out);
  const alerts = vehicles === null ? [] : dueAlertPending(sortByAvailability(vehicles));
  const pendingLoading = todayLoading || alertsLoading;

  return (
    <div className={PAIR}>
      <Panel
        title="Salen y vuelven"
        count={todayLoading || todayError !== null ? null : moves.length}
      >
        {todayLoading ? (
          <ListSkeleton bare rows={3} label="Cargando salidas y regresos" className="px-4" />
        ) : todayError !== null ? (
          <LoadError message={todayError} />
        ) : moves.length === 0 ? (
          <Empty text="Nada por hoy" />
        ) : (
          <ul>
            {moves.map((move) => (
              <MoveRow key={`${move.kind}:${move.agreementId}`} move={move} />
            ))}
          </ul>
        )}
      </Panel>

      <PendingPanel
        overdue={todayError === null && !todayLoading ? overdue : []}
        alerts={alertsError === null && !alertsLoading ? alerts : []}
        loading={pendingLoading}
        todayError={todayLoading ? null : todayError}
        alertsError={alertsLoading ? null : alertsError}
      />
    </div>
  );
}

function PendingPanel({
  overdue,
  alerts,
  loading,
  todayError,
  alertsError,
}: {
  overdue: readonly OverduePending[];
  alerts: readonly AlertPending[];
  loading: boolean;
  todayError: string | null;
  alertsError: string | null;
}) {
  const count = overdue.length + alerts.length;
  const empty = todayError === null && alertsError === null && count === 0;
  const failedWithoutRows = count === 0 && (todayError !== null || alertsError !== null);

  return (
    <Panel title="Pendientes" count={loading || failedWithoutRows ? null : count}>
      {loading ? (
        <ListSkeleton bare rows={3} label="Cargando pendientes" className="px-4" />
      ) : (
        <>
          {count === 0 ? null : (
            <ul>
              {overdue.map((row) => (
                <OverdueRow key={row.agreementId} row={row} />
              ))}
              {alerts.map((row) => (
                <AlertRow key={row.vehicleId} row={row} />
              ))}
            </ul>
          )}
          {todayError !== null ? <LoadError message={todayError} /> : null}
          {alertsError !== null ? <LoadError message={alertsError} /> : null}
          {empty ? <Empty text="Todo en orden" /> : null}
        </>
      )}
    </Panel>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count: number | null;
  children: ReactNode;
}) {
  return (
    <section className="bg-surface border-line rounded-row border">
      <h2 className="border-line text-body flex items-baseline gap-2 border-b px-4 py-3 font-semibold">
        {title}
        {count === null ? null : (
          <span className="text-dense text-text-faint font-medium tabular-nums">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-text-dim text-dense px-4 py-4">{text}</p>;
}

function LoadError({ message }: { message: string }) {
  return (
    <p className="text-danger-text text-body px-4 py-4" role="alert">
      {message}
    </p>
  );
}

function MoveRow({ move }: { move: HomeMove }) {
  const time = timeLabel(move.at);
  const when = move.kind === 'deliver' ? `Hoy · ${time}` : `Vuelve hoy · ${time}`;
  const late = move.kind === 'deliver' && Date.parse(move.at) < Date.now();
  const action =
    move.kind === 'deliver'
      ? { href: `/rentals/agreements/${move.agreementId}?action=deliver`, label: 'Entregar' }
      : { href: `/rentals/agreements/${move.agreementId}?action=return`, label: 'Recibir' };

  return (
    <li className="border-line-soft flex min-h-row flex-wrap items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
      <RowLink
        href={`/rentals/agreements/${move.agreementId}`}
        row={move}
        when={when}
        late={late}
      />
      <Button asChild size="sm" variant="outline">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    </li>
  );
}

function OverdueRow({ row }: { row: OverduePending }) {
  const when = `Debió volver ${shortCivil(instantToCivil(row.at))} · ${timeLabel(row.at)}`;

  return (
    <li className="border-line-soft flex min-h-row flex-wrap items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
      <RowLink href={`/rentals/agreements/${row.agreementId}`} row={row} when={when} late />
      {row.customerPhone.trim() === '' ? null : (
        <Button asChild size="sm" variant="outline">
          <a href={`tel:${row.customerPhone}`}>Llamar</a>
        </Button>
      )}
    </li>
  );
}

function AlertRow({ row }: { row: AlertPending }) {
  return (
    <li className="border-line-soft flex min-h-row items-center border-b px-4 py-2.5 last:border-b-0">
      <OriginLink
        href={`/rentals/fleet/${row.vehicleId}`}
        className="flex min-h-row min-w-0 flex-1 items-center gap-3"
      >
        <span className="min-w-0 flex-1">
          <Name plate={row.plate} vehicleName={row.vehicleName} />
          <span className="text-danger-text text-dense mt-0.5 block">{row.texts.join(' · ')}</span>
        </span>
      </OriginLink>
    </li>
  );
}

function RowLink({
  href,
  row,
  when,
  late,
}: {
  href: string;
  row: { plate: string; vehicleName: string; customerName: string };
  when: string;
  late: boolean;
}) {
  return (
    <OriginLink href={href} className="flex min-w-0 flex-1 items-center gap-3">
      <span className="min-w-0 flex-1">
        <Name plate={row.plate} vehicleName={row.vehicleName} />
        <span className="text-text-dim text-dense mt-0.5 block truncate">{row.customerName}</span>
      </span>
      <span
        className={cn('text-dense shrink-0 tabular-nums', late ? 'text-danger-text' : 'text-text')}
      >
        {when}
      </span>
    </OriginLink>
  );
}

function Name({ plate, vehicleName }: { plate: string; vehicleName: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {plate === '' ? null : <PlateChip plate={plate} size="sm" />}
      <span className="text-text truncate font-semibold">{vehicleName}</span>
    </span>
  );
}
