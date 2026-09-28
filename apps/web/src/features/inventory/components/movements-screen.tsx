'use client';

import { INVENTORY_MOVEMENT_TYPES, PERMISSIONS } from '@elite/shared';
import { useEffect, useMemo, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { DateRangeField } from '@/components/ui/date-field';
import { FilterBar, FiltersPopover } from '@/components/ui/filters-popover';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useEmployees } from '@/features/employees/hooks/use-employees';
import type { ComboboxOption } from '@/lib/combobox';
import { ALL_FILTER, isAll, uniqueOptions, withAllOption } from '@/lib/list-filters';
import { replaceQuery } from '@/lib/list-params';
import { useInventoryItems, useInventoryMovements } from '../hooks/use-inventory';
import { MOVEMENT_TYPE_META } from '../kardex';
import { movementsApiQuery, movementsFilterQuery, type MovementsFilterState } from '../list-params';
import { KardexTable } from './kardex-table';
import { Pager } from './pager';

/** Opciones del artículo: una página grande alcanza para elegir; el resto se busca en la lista. */
const ITEM_OPTIONS_PAGE_SIZE = 100;

const TYPE_OPTIONS = withAllOption(
  'Todos los tipos',
  INVENTORY_MOVEMENT_TYPES.map((type) => ({ value: type, label: MOVEMENT_TYPE_META[type].label })),
);

/**
 * `/inventory/movements` (spec 065): el kardex de todos los artículos en una
 * lista plana. Responde «quién despachó qué y a quién» y qué entró, con filtros
 * de tipo, artículo, empleado que recibió y fechas. Los filtros viven en la URL
 * para que la ficha que se abre desde una fila vuelva acá con ellos puestos.
 */
export function MovementsScreen({ initial }: { initial: MovementsFilterState }) {
  const { can } = usePermissions();
  const canListEmployees = can(PERMISSIONS.employees.actions.read.key);
  const [filters, setFilters] = useState<MovementsFilterState>(initial);

  useEffect(() => {
    replaceQuery(movementsFilterQuery(filters));
  }, [filters]);

  const update = (patch: Partial<MovementsFilterState>) =>
    setFilters((previous) => ({ ...previous, page: 1, ...patch }));

  const params = useMemo(() => movementsApiQuery(filters), [filters]);
  const movements = useInventoryMovements(params);
  const items = useInventoryItems({ includeInactive: true, pageSize: ITEM_OPTIONS_PAGE_SIZE });
  const employees = useEmployees(canListEmployees);

  const itemOptions: ComboboxOption[] = withAllOption(
    'Todos los artículos',
    (items.data?.items ?? []).map((item) => ({
      value: item.id,
      label: item.name,
      meta: item.code,
    })),
  );

  // Sin permiso para ver empleados, el filtro se arma con los que ya aparecen
  // en la página: nunca se pide una lista que el API negaría.
  const employeeOptions: ComboboxOption[] = withAllOption(
    'Cualquiera',
    canListEmployees
      ? (employees.data ?? []).map((employee) => ({ value: employee.id, label: employee.fullName }))
      : uniqueOptions(
          movements.data?.items ?? [],
          (movement) => movement.employee?.id,
          (movement) => movement.employee?.fullName ?? '',
        ),
  );

  const filtered = !isAll(filters.type) || !isAll(filters.itemId) || !isAll(filters.employeeId);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Movimientos"
        subtitle="Quién despachó qué, a quién, y qué entró. Todo el historial en una lista."
      />

      <FilterBar>
        <DateRangeField
          value={filters.range}
          onChange={(range) => update({ range })}
          aria-label="Rango de movimientos"
        />
        <FiltersPopover
          fields={[
            {
              id: 'type',
              label: 'Tipo',
              value: filters.type,
              options: TYPE_OPTIONS,
              onChange: (type) => update({ type }),
            },
            {
              id: 'item',
              label: 'Artículo',
              value: filters.itemId,
              options: itemOptions,
              onChange: (itemId) => update({ itemId }),
            },
            {
              id: 'employee',
              // Recibió un despacho o tomó un consumo (070).
              label: 'Empleado',
              value: filters.employeeId,
              options: employeeOptions,
              onChange: (employeeId) => update({ employeeId }),
            },
          ]}
          onReset={() => update({ type: ALL_FILTER, itemId: ALL_FILTER, employeeId: ALL_FILTER })}
        />
      </FilterBar>

      <KardexTable
        withItem
        page={movements.data}
        isLoading={movements.isPending}
        errorMessage={movements.error?.message ?? null}
        emptyTitle={filtered ? 'Ningún movimiento coincide' : 'Sin movimientos en estas fechas'}
        emptyMessage={
          filtered
            ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
            : 'Las entradas, despachos, ventas, consumos y ajustes del rango van a aparecer acá.'
        }
      />

      <Pager
        page={movements.data}
        noun={{ one: 'movimiento', many: 'movimientos' }}
        onPageChange={(page) => setFilters((previous) => ({ ...previous, page }))}
      />
    </div>
  );
}
