'use client';

import {
  MAINTENANCE_STATUS_ORDER,
  PERMISSIONS,
  VEHICLE_DOCUMENT_LABELS,
  fleetVehicleName,
  isPendingTask,
} from '@elite/shared';
import type { MaintenanceStatus, VehicleMaintenanceStatus } from '@elite/shared';
import {
  CalendarClock,
  CalendarArrowDown,
  FileWarning,
  ListChecks,
  MessageCircle,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { useUrlPage } from '@/lib/use-url-page';
import { cn } from '@/lib/utils';
import { REMINDERS_ICS_URL } from '../api';
import { useMaintenanceStatus } from '../hooks/use-fleet-maintenance';
import { documentLabel, leftLabel, missingTasksOf } from '../maintenance-view';
import { MaintenanceLogDialog } from './maintenance-log-dialog';
import { MaintenancePlanDialog } from './maintenance-plan-dialog';
import { MaintenanceStatusStamp, VehicleCell } from './maintenance-stamps';
import { WorkshopTextDialog } from './workshop-text-dialog';

/** Carros por página en cada lista (101). */
const PAGE_SIZE = 25;
const CAR_NOUN = { one: 'carro', many: 'carros' };

type Dialog =
  | { kind: 'log'; vehicleId?: string; taskIds?: string[] }
  | { kind: 'plan' }
  | { kind: 'workshop' }
  | null;

/** Lo peor de un carro, para el sello de su fila. */
function worstStatus(status: VehicleMaintenanceStatus): MaintenanceStatus {
  const all: MaintenanceStatus[] = [
    ...status.tasks.filter(isPendingTask).map((task) => task.status),
    ...status.documents.map((document) => document.status),
  ];

  return (
    all.sort(
      (left, right) => MAINTENANCE_STATUS_ORDER[left] - MAINTENANCE_STATUS_ORDER[right],
    )[0] ?? 'OK'
  );
}

/**
 * `/rentals/maintenance` (099): qué le toca a cada carro. Arriba las cifras;
 * después los pendientes por carro, con su sello y «Registrar servicio»; al
 * final los carros a los que falta cargarles el último servicio. Desde acá se
 * edita el plan, se manda la lista al taller y se bajan los recordatorios.
 */
export function MaintenanceScreen({
  initialPendingPage = 1,
  initialMissingPage = 1,
}: {
  initialPendingPage?: number;
  initialMissingPage?: number;
}) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  // Dos listas, dos páginas en la URL; las cifras de arriba son de toda la flota (101).
  const [pendingPage, setPendingPage] = useUrlPage('pendingPage', initialPendingPage);
  const [missingPage, setMissingPage] = useUrlPage('missingPage', initialMissingPage);
  const status = useMaintenanceStatus({
    view: 'pending',
    page: pendingPage,
    pageSize: PAGE_SIZE,
  });
  const missingStatus = useMaintenanceStatus({
    view: 'no_data',
    page: missingPage,
    pageSize: PAGE_SIZE,
  });
  const summary = status.data?.summary ?? { due: 0, soon: 0, noData: 0, documents: 0 };
  const pending = status.data?.items ?? [];
  const missing = missingTasksOf(missingStatus.data?.items ?? []);
  const [dialog, setDialog] = useState<Dialog>(null);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Mantenimiento" subtitle="Lo que le toca a cada carro de la flota">
        <Button type="button" variant="outline" onClick={() => setDialog({ kind: 'plan' })}>
          <ListChecks className="size-icon" strokeWidth={1.5} aria-hidden />
          Plan
        </Button>
        <Button type="button" variant="outline" onClick={() => setDialog({ kind: 'workshop' })}>
          <MessageCircle className="size-icon" strokeWidth={1.5} aria-hidden />
          Lista para el taller
        </Button>
        <a href={REMINDERS_ICS_URL} download className={cn(buttonVariants({ variant: 'outline' }))}>
          <CalendarArrowDown className="size-icon" strokeWidth={1.5} aria-hidden />
          Recordatorios (.ics)
        </a>
        {canManage ? (
          <Button type="button" onClick={() => setDialog({ kind: 'log' })}>
            <Wrench className="size-icon" strokeWidth={1.5} aria-hidden />
            Registrar servicio
          </Button>
        ) : null}
      </ScreenHeader>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard
          label="Vencidos"
          value={status.data ? summary.due : '—'}
          unit={summary.due === 1 ? 'tarea' : 'tareas'}
          tone={summary.due > 0 ? 'flame' : 'default'}
          icon={<Wrench className="size-icon" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Próximos"
          value={status.data ? summary.soon : '—'}
          unit={summary.soon === 1 ? 'tarea' : 'tareas'}
          icon={<CalendarClock className="size-icon" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Sin dato"
          value={status.data ? summary.noData : '—'}
          unit={summary.noData === 1 ? 'carro' : 'carros'}
          help="Carros a los que falta cargar el último servicio de alguna tarea: sin eso no se sabe cuándo les toca."
          icon={<ListChecks className="size-icon" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Documentos por vencer"
          value={status.data ? summary.documents : '—'}
          icon={<FileWarning className="size-icon" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="maintenance-pending">
        <h2 id="maintenance-pending" className="text-title text-text">
          Pendientes
        </h2>
        <DataTable<VehicleMaintenanceStatus>
          rows={pending}
          rowKey={(row) => row.vehicle.id}
          reference={(_, index) => pagedReference(status.data, index)}
          rowHref={(row) => `/rentals/fleet/${row.vehicle.id}/maintenance`}
          isLoading={status.isPending}
          errorMessage={status.error?.message ?? null}
          emptyTitle="Nada vencido ni próximo"
          emptyMessage="Cuando a un carro le toque un servicio o se le acerque un vencimiento, sale acá."
          columns={[
            {
              key: 'vehicle',
              header: 'Carro',
              stack: 'title',
              className: 'whitespace-normal',
              cell: (row) => <VehicleCell vehicle={row.vehicle} />,
            },
            {
              key: 'items',
              header: 'Qué le toca',
              headerClassName: 'w-full',
              className: 'whitespace-normal',
              cell: (row) => (
                <ul className="flex flex-col gap-2">
                  {row.tasks.filter(isPendingTask).map((task) => (
                    <li key={task.task.id} className="flex flex-wrap items-center gap-2">
                      <MaintenanceStatusStamp status={task.status} />
                      <span className="text-body">{task.task.name}</span>
                      <span className="text-text-dim text-dense tabular-nums">
                        {leftLabel(task)}
                      </span>
                    </li>
                  ))}
                  {row.documents.map((document) => (
                    <li key={document.kind} className="flex flex-wrap items-center gap-2">
                      <MaintenanceStatusStamp status={document.status} />
                      <span className="text-body">{VEHICLE_DOCUMENT_LABELS[document.kind]}</span>
                      <span className="text-text-dim text-dense tabular-nums">
                        {documentLabel(document.daysLeft)}
                      </span>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'km',
              header: 'Km',
              align: 'right',
              className: 'whitespace-nowrap',
              cell: (row) => (
                <span className="text-text-dim font-mono tabular-nums">
                  {row.vehicle.odometerKm} km
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Estado',
              stack: 'aside',
              className: 'whitespace-nowrap',
              cell: (row) => <MaintenanceStatusStamp status={worstStatus(row)} />,
            },
            ...(canManage
              ? [
                  {
                    key: 'actions',
                    header: 'Acciones',
                    stack: 'actions' as const,
                    className: 'whitespace-nowrap',
                    cell: (row: VehicleMaintenanceStatus) => (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDialog({
                            kind: 'log',
                            vehicleId: row.vehicle.id,
                            taskIds: row.tasks.filter(isPendingTask).map((task) => task.task.id),
                          });
                        }}
                      >
                        <Wrench
                          className="text-text-faint size-3.5"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        Registrar servicio
                        <span className="sr-only"> {fleetVehicleName(row.vehicle)}</span>
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <Pager page={status.data} noun={CAR_NOUN} onPageChange={setPendingPage} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="maintenance-missing">
        <div>
          <h2 id="maintenance-missing" className="text-title text-text">
            Sin datos
          </h2>
          <p className="text-text-dim text-dense [[data-density=bahia]_&]:text-body">
            Cargá el último servicio de cada tarea para que el sistema sepa cuándo le vuelve a
            tocar.
          </p>
        </div>
        <DataTable
          rows={missing}
          rowKey={(row) => row.status.vehicle.id}
          reference={(_, index) => pagedReference(missingStatus.data, index)}
          rowHref={(row) => `/rentals/fleet/${row.status.vehicle.id}/maintenance`}
          isLoading={missingStatus.isPending}
          errorMessage={missingStatus.error?.message ?? null}
          emptyTitle="Todos los carros tienen datos"
          emptyMessage="Cada tarea de cada carro ya tiene su último servicio cargado."
          columns={[
            {
              key: 'vehicle',
              header: 'Carro',
              stack: 'title',
              className: 'whitespace-normal',
              cell: (row) => <VehicleCell vehicle={row.status.vehicle} />,
            },
            {
              key: 'tasks',
              header: 'Falta cargar',
              headerClassName: 'w-full',
              className: 'whitespace-normal',
              cell: (row) => (
                <span className="text-text-dim text-body">
                  {row.tasks.map((task) => task.task.name).join(' · ')}
                </span>
              ),
            },
            ...(canManage
              ? [
                  {
                    key: 'actions',
                    header: 'Acciones',
                    stack: 'actions' as const,
                    className: 'whitespace-nowrap',
                    cell: (row: (typeof missing)[number]) => (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDialog({
                            kind: 'log',
                            vehicleId: row.status.vehicle.id,
                            taskIds: row.tasks.map((task) => task.task.id),
                          });
                        }}
                      >
                        Cargar último servicio
                        <span className="sr-only"> {fleetVehicleName(row.status.vehicle)}</span>
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <Pager page={missingStatus.data} noun={CAR_NOUN} onPageChange={setMissingPage} />
      </section>

      {dialog?.kind === 'log' ? (
        <MaintenanceLogDialog
          vehicleId={dialog.vehicleId}
          taskIds={dialog.taskIds}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'plan' ? <MaintenancePlanDialog onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'workshop' ? <WorkshopTextDialog onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
