'use client';

import { PERMISSIONS } from '@elite/shared';
import { useEffect, useMemo, useState } from 'react';

import { DateRangeField } from '@/components/ui/date-field';
import { FilterBar, FiltersPopover } from '@/components/ui/filters-popover';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useEmployees } from '@/features/employees/hooks/use-employees';
import type { ComboboxOption } from '@/lib/combobox';
import { ALL_FILTER, isAll, uniqueOptions, withAllOption } from '@/lib/list-filters';
import { replaceQuery } from '@/lib/list-params';
import { useInventoryItems, useInventoryMovements } from '../hooks/use-inventory';
import {
  MOVEMENT_TYPE_GROUPS,
  movementsApiQuery,
  movementsFilterQuery,
  type MovementsFilterState,
} from '../list-params';
import { InventoryFrame } from './inventory-frame';
import { KardexTable } from './kardex-table';
import { Pager } from './pager';
import { cn } from '@/lib/utils';

/** Opciones del artículo: una página grande alcanza para elegir; el resto se busca en la lista. */
const ITEM_OPTIONS_PAGE_SIZE = 100;

/**
 * `/inventory/movements` (spec 065): el kardex de todos los artículos en una
 * lista plana. Responde «quién despachó qué y a quién» y qué entró, con filtros
 * de tipo, artículo, empleado que recibió y fechas. Los filtros viven en la URL
 * para que la ficha que se abre desde una fila vuelva acá con ellos puestos.
 *
 * Es la pestaña «Movimientos» de Inventario (091): el tipo va en chips a la
 * vista —cinco grupos, no siete tipos— y artículo y empleado, en Filtros.
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
    <InventoryFrame section="movements">
      <div className="flex flex-col gap-4">
        <FilterBar>
          <DateRangeField
            value={filters.range}
            onChange={(range) => update({ range })}
            aria-label="Rango de movimientos"
          />
          <FiltersPopover
            fields={[
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
            onReset={() => update({ itemId: ALL_FILTER, employeeId: ALL_FILTER })}
          />
        </FilterBar>

        {/* 091: el tipo a la vista. Una devolución va con las ventas y una
          anulación con los consumos. */}
        <div role="group" aria-label="Tipo de movimiento" className="flex flex-wrap gap-2">
          {[{ key: ALL_FILTER, label: 'Todo' }, ...MOVEMENT_TYPE_GROUPS].map((group) => {
            const pressed = filters.type === group.key;

            return (
              <button
                key={group.key}
                type="button"
                aria-pressed={pressed}
                onClick={() => update({ type: group.key })}
                className={cn(
                  'inline-flex min-h-(--touch-min) cursor-pointer items-center rounded-full border-(length:--selectable-border) px-3.5 font-semibold',
                  'transition-[border-color,background-color] duration-(--duration-state) ease-standard [[data-density=bahia]_&]:px-5',
                  pressed
                    ? 'border-flame bg-flame/12 text-text'
                    : 'border-line bg-surface-2 text-text-dim hover:border-text-faint',
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>

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
    </InventoryFrame>
  );
}
