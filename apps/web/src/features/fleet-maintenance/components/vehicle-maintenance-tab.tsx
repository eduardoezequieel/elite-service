'use client';

import { PERMISSIONS, isPendingTask } from '@elite/shared';
import type { MaintenanceLog, MaintenanceTaskStatus } from '@elite/shared';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useFleetVehicle } from '@/features/fleet/hooks/use-fleet';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { formatCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { cn } from '@/lib/utils';
import { REMINDERS_ICS_URL } from '../api';
import { useMaintenanceLogs, useMaintenanceStatus } from '../hooks/use-fleet-maintenance';
import { ServiceEntryDialog } from './service-entry-dialog';
import { WorkshopTextDialog } from './workshop-text-dialog';

/** Servicios por página del historial (101). */
const LOGS_PAGE_SIZE = 25;

/**
 * La pestaña Servicio de un carro (110): lo que está por hacerse, anotar lo
 * que se hizo, y el historial. El texto al taller y el calendario viven en «⋯».
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
  const vehicle = useFleetVehicle(id);
  const status = useMaintenanceStatus({ vehicleId: id });
  const [page, setPage] = useUrlPage('page', initialPage, id);
  const logs = useMaintenanceLogs({ vehicleId: id, page, pageSize: LOGS_PAGE_SIZE });
  const current = status.data?.items[0];
  const pending = (current?.tasks ?? []).filter(isPendingTask);
  const [entry, setEntry] = useState(false);
  const [workshop, setWorkshop] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <Button type="button" onClick={() => setEntry(true)}>
            Anotar lo que se hizo
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Más">
              <MoreHorizontal className="size-icon" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setWorkshop(true)}>
              Texto para el taller
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={REMINDERS_ICS_URL}
                download
                className={cn(buttonVariants({ variant: 'ghost' }))}
              >
                Recordatorios
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DataTable<MaintenanceTaskStatus>
        rows={pending}
        rowKey={(task) => task.task.id}
        isLoading={status.isPending}
        errorMessage={status.error?.message ?? null}
        emptyTitle="Nada pendiente"
        emptyMessage=""
        columns={[
          {
            key: 'task',
            header: 'Qué hay que hacer',
            stack: 'title',
            className: 'whitespace-normal',
            cell: (task) => <span className="text-body font-semibold">{task.task.name}</span>,
          },
          {
            key: 'line',
            header: 'Cuándo',
            cell: (task) => <span className="text-body">{task.line}</span>,
          },
        ]}
      />

      <DataTable<MaintenanceLog>
        rows={logs.data?.items ?? []}
        rowKey={(log) => log.id}
        reference={(_, index) => pagedReference(logs.data, index)}
        isLoading={logs.isPending}
        errorMessage={logs.error?.message ?? null}
        emptyTitle="Nada todavía"
        emptyMessage=""
        columns={[
          {
            key: 'date',
            header: 'Fecha',
            stack: 'title',
            cell: (log) => <span className="tabular-nums">{formatCivil(log.performedAt)}</span>,
          },
          {
            key: 'what',
            header: 'Qué',
            className: 'whitespace-normal',
            cell: (log) => <span className="text-body">{log.taskName ?? 'Servicio'}</span>,
          },
          {
            key: 'km',
            header: 'Km',
            align: 'right',
            cell: (log) => (
              <span className="font-mono tabular-nums">
                {log.odometerKm === null ? '—' : log.odometerKm.toLocaleString('es-SV')}
              </span>
            ),
          },
          {
            key: 'cost',
            header: 'Costo',
            align: 'right',
            cell: (log) => (
              <span className="font-mono tabular-nums">
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

      {entry && vehicle.data !== undefined ? (
        <ServiceEntryDialog
          vehicleId={id}
          odometerKm={vehicle.data.odometerKm}
          onClose={() => setEntry(false)}
        />
      ) : null}
      {workshop ? <WorkshopTextDialog onClose={() => setWorkshop(false)} /> : null}
    </div>
  );
}
