'use client';

import { FLEET_EXPENSE_TYPES, FLEET_EXPENSE_TYPE_LABELS, PERMISSIONS } from '@elite/shared';
import type { FleetExpenseRow, FleetExpenseType } from '@elite/shared';
import { Pencil, Receipt, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DateRangeField } from '@/components/ui/date-field';
import { DeactivateConfirmDialog } from '@/components/ui/deactivate-confirm-dialog';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { StatCard } from '@/components/ui/stat-card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useFleetVehicles } from '@/features/fleet/hooks/use-fleet';
import { formatCivil, rangeSummary, type CivilRange } from '@/lib/civil-date';
import { isAll, withAllOption } from '@/lib/list-filters';
import { formatMoney, moneyParts } from '@/lib/money';
import { useDeleteFleetExpense, useFleetExpenses } from '../hooks/use-fleet-maintenance';
import { FleetExpenseDialog } from './fleet-expense-dialog';
import { ExpenseSourceStamp, VehicleCell } from './maintenance-stamps';
import { vehicleOptionLabel } from './vehicle-select';

const TYPE_OPTIONS = withAllOption(
  'Todos los tipos',
  FLEET_EXPENSE_TYPES.map((type) => ({ value: type, label: FLEET_EXPENSE_TYPE_LABELS[type] })),
);

/**
 * La lista de gastos (099): filtros por carro, tipo y fechas; el total del
 * filtro; y las filas de los tres orígenes. Las automáticas —lavado y multa—
 * no tienen acciones. La usan la pantalla Gastos y la pestaña del carro, que
 * fija el carro.
 */
export function FleetExpensesPanel({
  vehicleId,
  initialRange,
}: {
  /** En la ficha del carro: el carro fijo, sin filtro de carro. */
  vehicleId?: string;
  initialRange: CivilRange;
}) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const [range, setRange] = useState<CivilRange>(initialRange);
  const filters = useFilterValues(['vehicle', 'type'] as const);
  const vehicles = useFleetVehicles({}, vehicleId === undefined);
  const type = isAll(filters.values.type) ? undefined : (filters.values.type as FleetExpenseType);
  const selectedVehicle =
    vehicleId ?? (isAll(filters.values.vehicle) ? undefined : filters.values.vehicle);

  const expenses = useFleetExpenses({
    vehicleId: selectedVehicle,
    type,
    from: range.from,
    to: range.to,
  });
  const total = moneyParts(expenses.data?.total ?? '0.00');
  const count = expenses.data?.rows.length ?? 0;

  const [dialog, setDialog] = useState<FleetExpenseRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FleetExpenseRow | null>(null);
  const remove = useDeleteFleetExpense();
  const { toast } = useToast();

  const vehicleOptions = withAllOption(
    'Todos los carros',
    (vehicles.data ?? []).map((vehicle) => ({
      value: vehicle.id,
      label: vehicleOptionLabel(vehicle),
    })),
  );

  const newButton = canManage ? (
    <Button type="button" onClick={() => setDialog('new')}>
      <Receipt className="size-icon" strokeWidth={1.5} aria-hidden />
      Nuevo gasto
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <FilterBar>
        <DateRangeField value={range} onChange={setRange} aria-label="Fechas de los gastos" />
        <FiltersPopover
          fields={[
            ...(vehicleId === undefined
              ? [
                  {
                    id: 'vehicle',
                    label: 'Carro',
                    value: filters.values.vehicle,
                    options: vehicleOptions,
                    onChange: (value: string) => filters.set('vehicle', value),
                  },
                ]
              : []),
            {
              id: 'type',
              label: 'Tipo',
              value: filters.values.type,
              options: TYPE_OPTIONS,
              onChange: (value: string) => filters.set('type', value),
            },
          ]}
          onReset={filters.reset}
        />
        {newButton === null ? null : <div className="ml-auto max-sm:w-full">{newButton}</div>}
      </FilterBar>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={`Total · ${rangeSummary(range)}`}
          value={expenses.data ? total.whole : '—'}
          unit={expenses.data ? total.fraction : undefined}
          detail={expenses.data ? `${count} ${count === 1 ? 'gasto' : 'gastos'}` : undefined}
        />
      </div>

      <DataTable<FleetExpenseRow>
        rows={expenses.data?.rows ?? []}
        rowKey={(row) => `${row.source}:${row.id}`}
        isLoading={expenses.isPending}
        errorMessage={expenses.error?.message ?? null}
        emptyTitle="Sin gastos en estas fechas"
        emptyMessage="Los gastos anotados, los lavados del carwash y las multas no cargadas salen acá."
        emptyAction={newButton ?? undefined}
        columns={[
          {
            key: 'date',
            header: 'Fecha',
            className: 'whitespace-nowrap',
            cell: (row) => (
              <span className="font-mono tabular-nums">{formatCivil(row.incurredAt)}</span>
            ),
          },
          ...(vehicleId === undefined
            ? [
                {
                  key: 'vehicle',
                  header: 'Carro',
                  stack: 'title' as const,
                  className: 'whitespace-normal',
                  cell: (row: FleetExpenseRow) => <VehicleCell vehicle={row.vehicle} />,
                },
              ]
            : []),
          {
            key: 'type',
            header: 'Tipo',
            stack: vehicleId === undefined ? undefined : ('title' as const),
            className: 'whitespace-nowrap',
            cell: (row) => <span className="text-body">{FLEET_EXPENSE_TYPE_LABELS[row.type]}</span>,
          },
          {
            key: 'description',
            header: 'Descripción',
            headerClassName: 'w-full',
            className: 'whitespace-normal',
            cell: (row) => (
              <span className="text-text-dim">
                {row.description ?? '—'}
                {row.odometerKm === null ? null : (
                  <span className="text-text-faint font-mono"> · {row.odometerKm} km</span>
                )}
              </span>
            ),
          },
          {
            key: 'amount',
            header: 'Monto',
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (row) => (
              <span className="text-text font-mono font-semibold tabular-nums">
                {formatMoney(row.amount)}
              </span>
            ),
          },
          {
            key: 'source',
            header: 'Origen',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (row) => <ExpenseSourceStamp source={row.source} />,
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: 'Acciones',
                  stack: 'actions' as const,
                  className: 'whitespace-nowrap',
                  cell: (row: FleetExpenseRow) =>
                    row.editable ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDialog(row)}
                        >
                          <Pencil
                            className="text-text-faint size-3.5"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            remove.reset();
                            setDeleting(row);
                          }}
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />
                          Borrar
                        </Button>
                      </div>
                    ) : row.maintenanceLogId === null ? null : (
                      <span className="text-text-faint text-dense">Sale de un servicio</span>
                    ),
                },
              ]
            : []),
        ]}
      />

      {dialog === null ? null : (
        <FleetExpenseDialog
          expense={dialog === 'new' ? undefined : dialog}
          vehicleId={vehicleId}
          onClose={() => setDialog(null)}
        />
      )}

      <DeactivateConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Borrar gasto"
        description={
          deleting === null
            ? ''
            : `${FLEET_EXPENSE_TYPE_LABELS[deleting.type]} de ${formatMoney(deleting.amount)} del ${formatCivil(deleting.incurredAt)}. No se puede deshacer.`
        }
        confirmLabel="Borrar"
        loading={remove.isPending}
        error={remove.error?.message ?? null}
        onConfirm={() => {
          if (deleting === null) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast({ title: 'Gasto borrado', description: formatMoney(deleting.amount) });
              setDeleting(null);
            },
          });
        }}
      />
    </div>
  );
}
