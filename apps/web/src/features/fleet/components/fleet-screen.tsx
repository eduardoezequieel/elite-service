'use client';

import { PERMISSIONS, fleetVehicleName } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlateChip } from '@/components/ui/plate-chip';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { MaintenancePlanDialog } from '@/features/fleet-maintenance/components/maintenance-plan-dialog';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { formatMoney } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { useFleetVehicles } from '../hooks/use-fleet';
import { FleetAlertsStamp, FleetAvailabilityStamp } from './fleet-availability-stamp';
import { FleetViewSwitch } from './fleet-view-switch';
import { FleetVehicleDialog } from './fleet-vehicle-create-dialog';

/** Filas por página (101). */
const PAGE_SIZE = 25;

/**
 * Los carros (110): placa, tarifa del día y la palabra del día. Los retirados
 * no entran. El aviso se cuenta acá; el texto se lee en la ficha.
 */
export function FleetScreen({ initialPage = 1 }: { initialPage?: number }) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.fleet.actions.read.key);
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const canReports = can(PERMISSIONS.rentals.actions.reports.key);
  const [page, setPage] = useUrlPage('page', initialPage, 'fleet');
  const vehicles = useFleetVehicles({ page, pageSize: PAGE_SIZE }, canRead);
  const [creating, setCreating] = useState(false);
  const [plan, setPlan] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Carros">
        {canReports ? <FleetViewSwitch current="cars" /> : null}
        {canManage ? (
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
            Nuevo carro
          </Button>
        ) : null}
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Más">
                <MoreHorizontal className="size-icon" strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPlan(true)}>Plan de servicio</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </ScreenHeader>

      <DataTable<FleetVehicle>
        rows={vehicles.data?.items ?? []}
        rowKey={(vehicle) => vehicle.id}
        reference={(_, index) => pagedReference(vehicles.data, index)}
        rowHref={(vehicle) => `/rentals/fleet/${vehicle.id}`}
        isLoading={vehicles.isPending}
        errorMessage={vehicles.error?.message ?? null}
        emptyTitle="Nada todavía"
        emptyMessage=""
        columns={[
          {
            key: 'vehicle',
            header: 'Carro',
            stack: 'title',
            className: 'whitespace-normal',
            cell: (vehicle) => (
              <span className="flex flex-col gap-1">
                <span className="text-body font-semibold">{fleetVehicleName(vehicle)}</span>
                {vehicle.plate === null ? (
                  <span className="text-text-faint text-dense">Sin placa</span>
                ) : (
                  <PlateChip plate={vehicle.plate} size="sm" />
                )}
              </span>
            ),
          },
          {
            key: 'rate',
            header: 'Por día',
            align: 'right',
            cell: (vehicle) => (
              <span className="font-mono tabular-nums">{formatMoney(vehicle.dailyRate)}</span>
            ),
          },
          {
            key: 'state',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (vehicle) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <FleetAvailabilityStamp availability={vehicle.availability} />
                <FleetAlertsStamp alerts={vehicle.alerts} />
              </span>
            ),
          },
        ]}
      />
      <Pager page={vehicles.data} noun={{ one: 'carro', many: 'carros' }} onPageChange={setPage} />

      {creating ? <FleetVehicleDialog onClose={() => setCreating(false)} /> : null}
      {plan ? <MaintenancePlanDialog onClose={() => setPlan(false)} /> : null}
    </div>
  );
}
