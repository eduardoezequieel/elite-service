'use client';

import {
  FLEET_CATEGORY_LABELS,
  FLEET_STATUS_LABELS,
  FLEET_VEHICLE_STATUSES,
  PERMISSIONS,
  fleetVehicleName,
} from '@elite/shared';
import type { FleetVehicle, FleetVehicleStatus } from '@elite/shared';
import { Car, Pencil, Search } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { todayCivil } from '@/lib/civil-date';
import { isAll, withAllOption } from '@/lib/list-filters';
import { formatMoney } from '@/lib/money';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useFleetVehicles } from '../hooks/use-fleet';
import { upcomingExpiries } from '../vehicle-form';
import { FleetExpiries } from './fleet-expiries';
import { FleetStatusStamp } from './fleet-status-stamp';
import { FleetVehicleDialog } from './fleet-vehicle-dialog';

const STATUS_OPTIONS = withAllOption(
  'Todos los estados',
  FLEET_VEHICLE_STATUSES.map((status) => ({ value: status, label: FLEET_STATUS_LABELS[status] })),
);

/** Si los ajustes no llegaron todavía, el aviso de vencimientos usa el del prototipo. */
const DEFAULT_DAYS_ALERT = 7;

function countsLabel(total: number): string {
  return total === 1 ? '1 carro' : `${total} carros`;
}

/**
 * La flota de la rentadora (095): cada carro con su tarifa, su estado y los
 * vencimientos que se acercan. La fila abre la ficha del carro.
 */
export function FleetScreen() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.fleet.actions.read.key);
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);

  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const filters = useFilterValues(['status'] as const);
  const status = isAll(filters.values.status)
    ? undefined
    : (filters.values.status as FleetVehicleStatus);

  const vehicles = useFleetVehicles({ q: search === '' ? undefined : search, status }, canRead);
  const all = useFleetVehicles({}, canRead);
  const settings = useRentalSettings(canRead);
  const daysAlert = settings.data?.daysAlert ?? DEFAULT_DAYS_ALERT;
  const today = todayCivil();

  const [dialog, setDialog] = useState<FleetVehicle | 'new' | null>(null);
  const filtering = search !== '' || status !== undefined;

  const newVehicleButton = canManage ? (
    <Button type="button" onClick={() => setDialog('new')}>
      <Car className="size-icon" strokeWidth={1.5} aria-hidden />
      Nuevo carro
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Flota" subtitle={all.data ? countsLabel(all.data.length) : '\u00a0'}>
        {(all.data?.length ?? 0) > 0 ? newVehicleButton : null}
      </ScreenHeader>

      <FilterBar>
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="fleet-search">Buscar por placa, marca o modelo</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="fleet-search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="P53DBC o Yaris"
                autoComplete="off"
              />
            </div>
          </FieldBox>
        </div>
        <FiltersPopover
          fields={[
            {
              id: 'status',
              label: 'Estado',
              value: filters.values.status,
              options: STATUS_OPTIONS,
              onChange: (value) => filters.set('status', value),
            },
          ]}
          onReset={filters.reset}
        />
      </FilterBar>

      <DataTable
        rows={vehicles.data ?? []}
        rowKey={(vehicle) => vehicle.id}
        rowHref={(vehicle) => `/rentals/fleet/${vehicle.id}`}
        isLoading={vehicles.isPending}
        errorMessage={vehicles.error?.message ?? null}
        emptyTitle={filtering ? 'Ningún carro coincide' : 'Todavía no hay carros'}
        emptyMessage={
          filtering
            ? 'Probá con otra búsqueda o restablecé los filtros.'
            : 'Cada carro de la rentadora va acá con su tarifa. Cargá el primero con «Nuevo carro».'
        }
        emptyAction={filtering ? undefined : (newVehicleButton ?? undefined)}
        columns={[
          {
            key: 'plate',
            header: 'Placa',
            stack: 'title',
            className: 'whitespace-nowrap',
            cell: (vehicle) =>
              vehicle.plate === null ? (
                <span className="text-text-faint text-dense">Sin placa</span>
              ) : (
                <PlateChip plate={vehicle.plate} />
              ),
          },
          {
            key: 'name',
            header: 'Carro',
            headerClassName: 'w-full',
            cell: (vehicle) => (
              <span className="text-body font-semibold">{fleetVehicleName(vehicle)}</span>
            ),
          },
          {
            key: 'category',
            header: 'Tipo',
            className: 'whitespace-nowrap',
            cell: (vehicle) => (
              <span className="text-text-dim">{FLEET_CATEGORY_LABELS[vehicle.category]}</span>
            ),
          },
          {
            key: 'dailyRate',
            header: 'Tarifa diaria',
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (vehicle) => (
              <span className="text-text font-mono font-semibold">
                {formatMoney(vehicle.dailyRate)}
              </span>
            ),
          },
          {
            key: 'expiries',
            header: 'Vencimientos',
            className: 'whitespace-nowrap',
            cell: (vehicle) => (
              <FleetExpiries expiries={upcomingExpiries(vehicle, today, daysAlert)} />
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (vehicle) => <FleetStatusStamp status={vehicle.status} />,
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: 'Acciones',
                  stack: 'actions' as const,
                  className: 'whitespace-nowrap',
                  cell: (vehicle: FleetVehicle) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDialog(vehicle);
                      }}
                    >
                      <Pencil className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
                      Editar
                      <span className="sr-only"> {fleetVehicleName(vehicle)}</span>
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {dialog === null ? null : (
        <FleetVehicleDialog
          vehicle={dialog === 'new' ? undefined : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
