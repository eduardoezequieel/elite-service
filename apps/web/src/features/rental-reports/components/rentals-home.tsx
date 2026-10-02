'use client';

import {
  FLEET_BOARD_STATE_LABELS,
  PERMISSIONS,
  VEHICLE_DOCUMENT_LABELS,
  fleetVehicleName,
} from '@elite/shared';
import type {
  DashboardDay,
  DashboardEvent,
  FleetBoardTile,
  RentalDashboard,
  ReportVehicleRef,
} from '@elite/shared';
import { Car, Plus, SearchCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { Stamp, type StampTone } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { CIVIL_TZ, dayLabel, timeLabel } from '@/lib/civil-date';
import { moneyParts } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useRentalDashboard } from '../hooks/use-rental-reports';
import {
  BOARD_STATE_TONES,
  boardTileLine,
  greeting,
  percentLabel,
  shortName,
} from '../report-view';
import { OccupancyBars } from './occupancy-bars';
import { ReportSection } from './report-parts';

const hourFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: CIVIL_TZ,
});

function vehicleShort(vehicle: Pick<ReportVehicleRef, 'make' | 'model'>): string {
  return `${vehicle.make} ${vehicle.model}`;
}

/**
 * El inicio de la rentadora (100): el tablero de la flota, lo que sale y entra
 * hoy y mañana, los próximos 7 días, el mes y los pendientes. Reemplaza la
 * pantalla vacía de la 094.
 */
export function RentalsHome() {
  const dashboard = useRentalDashboard();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const hello = greeting(Number(hourFormatter.format(new Date())));

  const actions = (
    <>
      <Button asChild variant="secondary">
        <Link href="/rentals/availability">
          <SearchCheck className="size-icon" strokeWidth={1.5} aria-hidden />
          ¿Qué hay libre?
        </Link>
      </Button>
      {canManage ? (
        <Button asChild>
          <Link href="/rentals/agreements/new">
            <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
            Nueva renta
          </Link>
        </Button>
      ) : null}
    </>
  );

  if (dashboard.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <ScreenHeader title={hello} subtitle="Renta de carros" />
        <DetailSkeleton label="Cargando el inicio" />
      </div>
    );
  }

  if (dashboard.error !== null) {
    return (
      <div className="flex flex-col gap-5">
        <ScreenHeader title={hello} subtitle="Renta de carros" />
        <p className="text-danger-text text-body" role="alert">
          {dashboard.error.message}
        </p>
      </div>
    );
  }

  const data = dashboard.data;

  if (data.fleet.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <ScreenHeader title={hello} subtitle={dayLabel(data.date)} />
        <EmptyState
          icon={Car}
          title="Empezá agregando tu flota"
          description="Registrá cada carro con su placa y tarifa diaria para poder asignar rentas."
          action={
            <Button asChild>
              <Link href="/rentals/fleet">Ir a Flota</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <ScreenHeader title={hello} subtitle={`${dayLabel(data.date)} · ${fleetSummary(data)}`}>
        {actions}
      </ScreenHeader>

      <ReportSection title="Tablero de la flota" aside={`${data.fleet.length} carros`}>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 [[data-density=bahia]_&]:grid-cols-1">
          {data.fleet.map((tile) => (
            <li key={tile.vehicle.id}>
              <FleetTile tile={tile} />
            </li>
          ))}
        </ul>
      </ReportSection>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <DaySection title="Hoy" day={data.today} empty="No hay salidas ni regresos para hoy." />
        <DaySection
          title="Mañana"
          day={data.tomorrow}
          empty="No hay salidas ni regresos para mañana."
        />
      </div>

      <ReportSection title="Próximos 7 días" aside="Carros ocupados cada día">
        <OccupancyBars days={data.next7Days} />
      </ReportSection>

      <ReportSection title="Este mes">
        <MonthFigures month={data.month} />
      </ReportSection>

      <ReportSection title="Pendientes">
        <PendingList pending={data.pending} />
      </ReportSection>
    </div>
  );
}

function fleetSummary(data: RentalDashboard): string {
  const count = (state: FleetBoardTile['state']) =>
    data.fleet.filter((tile) => tile.state === state).length;
  const out = count('OUT') + count('LATE');
  const parts = [`${out} rentados`, `${count('FREE')} disponibles`];

  if (count('BOOKED') > 0) parts.push(`${count('BOOKED')} por salir`);
  if (count('IN_SHOP') > 0) parts.push(`${count('IN_SHOP')} en taller`);

  return parts.join(', ');
}

function FleetTile({ tile }: { tile: FleetBoardTile }) {
  return (
    <OriginLink
      href={`/rentals/fleet/${tile.vehicle.id}`}
      className="border-line-soft bg-surface hover:bg-surface-2 focus-visible:bg-surface-2 flex h-full min-h-(--touch-min) flex-col gap-3 rounded-row border px-4 py-3.5 transition-colors duration-(--duration-state) ease-standard"
    >
      <span className="flex items-center justify-between gap-2">
        {tile.vehicle.plate === null ? (
          <span className="text-text-faint text-dense">Sin placa</span>
        ) : (
          <PlateChip plate={tile.vehicle.plate} size="sm" />
        )}
        <Stamp label={FLEET_BOARD_STATE_LABELS[tile.state]} tone={BOARD_STATE_TONES[tile.state]} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-text text-body font-semibold [[data-density=bahia]_&]:text-(length:--lead-size)">
          {fleetVehicleName(tile.vehicle)}
        </span>
        <span className="text-text-dim text-dense [[data-density=bahia]_&]:text-body">
          {boardTileLine(tile)}
        </span>
      </span>
    </OriginLink>
  );
}

function DaySection({ title, day, empty }: { title: string; day: DashboardDay; empty: string }) {
  const events = [...day.pickups, ...day.returns].sort(
    (left, right) => Date.parse(left.at) - Date.parse(right.at),
  );

  return (
    <ReportSection
      title={title}
      aside={`${day.pickups.length} ${day.pickups.length === 1 ? 'salida' : 'salidas'} · ${day.returns.length} ${day.returns.length === 1 ? 'regreso' : 'regresos'}`}
    >
      {events.length === 0 ? (
        <ItemList>
          <li className="text-text-dim px-4 py-3.5 text-body">{empty}</li>
        </ItemList>
      ) : (
        <ItemList>
          {events.map((event) => (
            <li key={`${event.kind}-${event.agreementId}`}>
              <EventRow event={event} />
            </li>
          ))}
        </ItemList>
      )}
    </ReportSection>
  );
}

function ItemList({ children }: { children: ReactNode }) {
  return (
    <ul className="border-line-soft bg-surface divide-line-soft flex flex-col divide-y rounded-row border">
      {children}
    </ul>
  );
}

function ItemLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <OriginLink
      href={href}
      className="hover:bg-surface-2 focus-visible:bg-surface-2 flex min-h-(--row-h) items-center gap-3 px-4 py-2.5 transition-colors duration-(--duration-state) ease-standard first:rounded-t-row last:rounded-b-row"
    >
      {children}
    </OriginLink>
  );
}

function EventRow({ event }: { event: DashboardEvent }) {
  const pickup = event.kind === 'PICKUP';

  return (
    <ItemLink href={`/rentals/agreements/${event.agreementId}`}>
      <span className="flex w-20 shrink-0 flex-col">
        <span
          className={cn(
            'text-dense',
            event.overdue ? 'text-danger-text font-semibold' : 'text-text-faint',
          )}
        >
          {event.overdue ? 'Atrasado' : pickup ? 'Sale' : 'Regresa'}
        </span>
        <span className="font-mono text-body tabular-nums">{timeLabel(event.at)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-text truncate text-body font-semibold">
          {pickup ? 'Entregar a' : 'Recibir de'} {shortName(event.customerName)}
        </span>
        <span className="text-text-dim truncate text-dense">
          {[vehicleShort(event.vehicle), event.location].join(' · ')}
        </span>
      </span>
      {event.vehicle.plate === null ? null : (
        <PlateChip plate={event.vehicle.plate} size="sm" className="max-sm:hidden" />
      )}
    </ItemLink>
  );
}

function MonthFigures({ month }: { month: RentalDashboard['month'] }) {
  const income = moneyParts(month.income);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [[data-density=bahia]_&]:grid-cols-1">
      <StatCard
        label="Ingresos por rentas"
        value={income.whole}
        unit={income.fraction}
        detail="Según los días rentados en el mes"
      />
      <StatCard
        label="Rentas"
        value={month.agreements}
        unit={month.agreements === 1 ? 'renta' : 'rentas'}
        detail="Que tocan este mes"
      />
      <StatCard
        label="Ocupación"
        value={percentLabel(month.occupancy)}
        detail="Promedio de la flota"
      />
    </div>
  );
}

interface PendingItem {
  key: string;
  href: string;
  tone: StampTone;
  label: string;
  title: string;
  detail: string;
}

function pendingItems(pending: RentalDashboard['pending']): PendingItem[] {
  return [
    ...pending.late.map((event) => ({
      key: `late-${event.agreementId}`,
      href: `/rentals/agreements/${event.agreementId}`,
      tone: 'red' as const,
      label: 'Atrasado',
      title: `${vehicleShort(event.vehicle)} no ha regresado`,
      detail: `${shortName(event.customerName)} debía devolverlo ${dayLabel(event.at)} a las ${timeLabel(event.at)}`,
    })),
    ...pending.balances.map((balance) => ({
      key: `balance-${balance.agreementId}`,
      href: `/rentals/agreements/${balance.agreementId}`,
      tone: 'amber' as const,
      label: 'Saldo',
      title: `Saldo pendiente de $${balance.balance}`,
      detail: `${shortName(balance.customerName)}, renta del ${dayLabel(balance.pickupAt)}`,
    })),
    ...pending.maintenanceDue.map((item) => ({
      key: `maintenance-${item.vehicle.id}`,
      href: `/rentals/fleet/${item.vehicle.id}/maintenance`,
      tone: item.status === 'DUE' ? ('red' as const) : ('amber' as const),
      label: item.status === 'DUE' ? 'Vencido' : 'Próximo',
      title: `${vehicleShort(item.vehicle)}${item.vehicle.plate === null ? '' : ` (${item.vehicle.plate})`}`,
      detail: `${item.status === 'DUE' ? 'Servicios vencidos' : 'Le toca pronto'}: ${item.tasks
        .map((task) => task.name.toLowerCase())
        .join(', ')}`,
    })),
    ...pending.documentsDue.map((document) => ({
      key: `document-${document.vehicle.id}-${document.kind}`,
      href: `/rentals/fleet/${document.vehicle.id}`,
      tone: document.status === 'DUE' ? ('red' as const) : ('amber' as const),
      label: document.status === 'DUE' ? 'Vencido' : 'Por vencer',
      title: `${VEHICLE_DOCUMENT_LABELS[document.kind]} de ${vehicleShort(document.vehicle)}`,
      detail:
        document.daysLeft < 0
          ? `Venció hace ${-document.daysLeft} ${document.daysLeft === -1 ? 'día' : 'días'}`
          : document.daysLeft === 0
            ? 'Vence hoy'
            : `Vence en ${document.daysLeft} ${document.daysLeft === 1 ? 'día' : 'días'}`,
    })),
  ];
}

function PendingList({ pending }: { pending: RentalDashboard['pending'] }) {
  const items = pendingItems(pending);

  if (items.length === 0) {
    return (
      <ItemList>
        <li className="text-text-dim px-4 py-3.5 text-body">Todo en orden. No hay pendientes.</li>
      </ItemList>
    );
  }

  return (
    <ItemList>
      {items.map((item) => (
        <li key={item.key}>
          <ItemLink href={item.href}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-text truncate text-body font-semibold">{item.title}</span>
              <span className="text-text-dim text-dense [[data-density=bahia]_&]:text-body">
                {item.detail}
              </span>
            </span>
            <Stamp label={item.label} tone={item.tone} />
          </ItemLink>
        </li>
      ))}
    </ItemList>
  );
}
