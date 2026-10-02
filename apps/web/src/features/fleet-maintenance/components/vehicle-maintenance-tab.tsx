'use client';

import { PERMISSIONS, VEHICLE_DOCUMENT_LABELS } from '@elite/shared';
import type { MaintenanceLog, MaintenanceTaskStatus } from '@elite/shared';
import { Wrench } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { formatCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { useMaintenanceLogs, useMaintenanceStatus } from '../hooks/use-fleet-maintenance';
import { documentLabel, intervalLabel, leftLabel } from '../maintenance-view';
import { MaintenanceLogDialog } from './maintenance-log-dialog';
import { MaintenanceStatusStamp } from './maintenance-stamps';

/** Servicios por página del historial (101). */
const LOGS_PAGE_SIZE = 25;

/**
 * La pestaña Mantenimiento de la ficha de un carro (099): cada tarea con lo
 * que le falta en km y días, los documentos por vencer y el historial de
 * servicios. El marco (cabecera y pestañas) lo pone el layout de la 095.
 */
export function VehicleMaintenanceTab({
  id,
  initialPage = 1,
}: {
  id: string;
  initialPage?: number;
}) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const status = useMaintenanceStatus({ vehicleId: id });
  const [page, setPage] = useUrlPage('page', initialPage, id);
  const logs = useMaintenanceLogs({ vehicleId: id, page, pageSize: LOGS_PAGE_SIZE });
  // Con `vehicleId` la página trae un solo carro: este.
  const current = status.data?.items[0];
  const [dialog, setDialog] = useState<{ taskIds: string[] } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3 px-card">
        <CardSectionHeading
          aside={
            current === undefined
              ? undefined
              : `${current.vehicle.odometerKm} km · ${current.kmPerDay} km por día`
          }
        >
          Estado por tarea
        </CardSectionHeading>
        {canManage ? (
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              className="max-sm:w-full"
              onClick={() => setDialog({ taskIds: [] })}
            >
              <Wrench className="size-icon" strokeWidth={1.5} aria-hidden />
              Registrar servicio
            </Button>
          </div>
        ) : null}

        <DataTable<MaintenanceTaskStatus>
          rows={current?.tasks ?? []}
          rowKey={(task) => task.task.id}
          isLoading={status.isPending}
          errorMessage={status.error?.message ?? null}
          emptyMessage="El plan no tiene tareas activas."
          columns={[
            {
              key: 'task',
              header: 'Tarea',
              stack: 'title',
              headerClassName: 'w-full',
              className: 'whitespace-normal',
              cell: (task) => (
                <span className="flex flex-col">
                  <span className="text-body font-semibold">{task.task.name}</span>
                  <span className="text-text-faint text-dense">{intervalLabel(task.task)}</span>
                </span>
              ),
            },
            {
              key: 'last',
              header: 'Último servicio',
              className: 'whitespace-nowrap',
              cell: (task) =>
                task.lastAt === null ? (
                  <span className="text-text-faint">Sin cargar</span>
                ) : (
                  <span className="font-mono tabular-nums">
                    {formatCivil(task.lastAt)}
                    {task.lastKm === null ? null : ` · ${task.lastKm} km`}
                  </span>
                ),
            },
            {
              key: 'left',
              header: 'Falta',
              className: 'whitespace-nowrap',
              cell: (task) => (
                <span className="text-text-dim tabular-nums">
                  {task.status === 'NO_DATA' ? '—' : leftLabel(task)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Estado',
              stack: 'aside',
              className: 'whitespace-nowrap',
              cell: (task) => <MaintenanceStatusStamp status={task.status} />,
            },
            ...(canManage
              ? [
                  {
                    key: 'actions',
                    header: 'Acciones',
                    stack: 'actions' as const,
                    className: 'whitespace-nowrap',
                    cell: (task: MaintenanceTaskStatus) => (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDialog({ taskIds: [task.task.id] })}
                      >
                        Registrar
                        <span className="sr-only"> {task.task.name}</span>
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      {current !== undefined && current.documents.length > 0 ? (
        <Card className="gap-3 px-card">
          <CardSectionHeading>Documentos por vencer</CardSectionHeading>
          <ul className="flex flex-col gap-2">
            {current.documents.map((document) => (
              <li key={document.kind} className="flex flex-wrap items-center gap-2">
                <MaintenanceStatusStamp status={document.status} />
                <span className="text-body">{VEHICLE_DOCUMENT_LABELS[document.kind]}</span>
                <span className="text-text-dim text-dense tabular-nums">
                  {documentLabel(document.daysLeft)} · {formatCivil(document.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="gap-3 px-card">
        <CardSectionHeading>Historial de servicios</CardSectionHeading>
        <DataTable<MaintenanceLog>
          rows={logs.data?.items ?? []}
          rowKey={(log) => log.id}
          reference={(_, index) => pagedReference(logs.data, index)}
          isLoading={logs.isPending}
          errorMessage={logs.error?.message ?? null}
          emptyTitle="Sin servicios registrados"
          emptyMessage="Cada servicio que se registre para este carro queda acá."
          columns={[
            {
              key: 'date',
              header: 'Fecha',
              className: 'whitespace-nowrap',
              cell: (log) => (
                <span className="font-mono tabular-nums">{formatCivil(log.performedAt)}</span>
              ),
            },
            {
              key: 'task',
              header: 'Tarea',
              stack: 'title',
              headerClassName: 'w-full',
              className: 'whitespace-normal',
              cell: (log) => (
                <span className="flex flex-col">
                  <span className="text-body font-semibold">
                    {log.taskName ?? 'Tarea eliminada'}
                  </span>
                  {log.notes === null ? null : (
                    <span className="text-text-dim text-dense whitespace-pre-line">
                      {log.notes}
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: 'km',
              header: 'Km',
              align: 'right',
              className: 'whitespace-nowrap',
              cell: (log) => (
                <span className="font-mono tabular-nums">
                  {log.odometerKm === null ? '—' : `${log.odometerKm} km`}
                </span>
              ),
            },
            {
              key: 'shop',
              header: 'Taller',
              className: 'whitespace-nowrap',
              cell: (log) => <span className="text-text-dim">{log.shop ?? '—'}</span>,
            },
            {
              key: 'cost',
              header: 'Costo',
              align: 'right',
              className: 'whitespace-nowrap',
              cell: (log) => (
                <span className="font-mono font-semibold tabular-nums">
                  {log.cost === null ? '—' : formatMoney(log.cost)}
                </span>
              ),
            },
          ]}
        />
        <Pager
          page={logs.data}
          noun={{ one: 'servicio', many: 'servicios' }}
          onPageChange={setPage}
        />
      </Card>

      {dialog === null ? null : (
        <MaintenanceLogDialog
          vehicleId={id}
          taskIds={dialog.taskIds}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
