'use client';

import { PERMISSIONS } from '@elite/shared';
import type { PublicEmployee } from '@elite/shared';
import { ChartColumn, Eye, Pencil, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { activityOptions, countActiveFilters, matchesActivity } from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { useEmployees } from '../hooks/use-employees';
import { EmployeeDialog } from './employee-dialog';

/**
 * Empleados de pista, administrados desde la oficina.
 *
 * Mismo patrón que `/settings/users`: tabla del sistema, sin borrar —se
 * desactivan (RN-13)—, y el inactivo lleva la regla de anulación sobre el
 * nombre con su sello, nunca opacidad.
 *
 * A diferencia de usuarios, acá **sí** aparecen todas las filas: un empleado no
 * es el propio usuario que está mirando, así que no hay nada de qué protegerlo.
 */
export function EmployeesScreen() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.employees.actions.read.key);
  const canManage = can(PERMISSIONS.employees.actions.manage.key);
  const canSeePerformance = can(PERMISSIONS.carwash.actions.commissions.key);
  const employees = useEmployees(canRead);
  const [editing, setEditing] = useState<PublicEmployee | null>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim().toLowerCase());
  const searching = search !== '';
  const extra = useFilterValues(['active'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  const narrowing = searching || extraActive > 0;
  const all = useMemo(() => employees.data ?? [], [employees.data]);
  const rows = useMemo(() => {
    return all.filter((employee) => {
      if (search !== '') {
        const hit =
          employee.fullName.toLowerCase().includes(search) ||
          employee.username.toLowerCase().includes(search);
        if (!hit) return false;
      }

      return matchesActivity(employee.isActive, extra.values.active);
    });
  }, [all, extra.values.active, search]);

  const newEmployeeButton = canManage ? (
    <Button
      type="button"
      onClick={() => {
        setEditing(null);
        setOpen(true);
      }}
    >
      Nuevo empleado
    </Button>
  ) : null;

  return (
    <div>
      <ScreenHeader title="Empleados">
        {canManage && all.length > 0 ? newEmployeeButton : null}
      </ScreenHeader>

      <FilterBar className="mb-4">
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="employee-search">Buscar por nombre o usuario</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="employee-search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                autoComplete="off"
              />
            </div>
          </FieldBox>
        </div>
        <FiltersPopover
          fields={[
            {
              id: 'active',
              label: 'Estado',
              value: extra.values.active,
              options: activityOptions('Todos los estados', 'Activos', 'Inactivos'),
              onChange: (value) => extra.set('active', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      <DataTable
        rows={rows}
        rowKey={(employee) => employee.id}
        isLoading={employees.isPending}
        errorMessage={employees.error?.message ?? null}
        emptyTitle={narrowing ? 'Ningún empleado coincide' : 'Todavía no hay empleados'}
        emptyMessage={
          searching
            ? `No hay nombre ni usuario que coincida con «${search}».`
            : extraActive > 0
              ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
              : 'Acá van los empleados que entran a la pista con su PIN.'
        }
        emptyAction={!narrowing && all.length === 0 ? newEmployeeButton : undefined}
        columns={[
          {
            key: 'name',
            header: 'Nombre',
            headerClassName: 'w-full',
            stack: 'title',
            cell: (employee) => (
              <span className={cn('text-body font-semibold', !employee.isActive && 'is-ruled-out')}>
                {employee.fullName}
              </span>
            ),
          },
          {
            key: 'username',
            header: 'Usuario',
            className: 'whitespace-nowrap',
            cell: (employee) => (
              <span className="text-text-dim font-mono text-dense">{employee.username}</span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (employee) =>
              employee.isActive ? (
                <Stamp tone="green" label="Activo" />
              ) : (
                <Stamp tone="neutral" label="Inactivo" />
              ),
          },
          {
            key: 'actions',
            header: 'Acciones',
            stack: 'actions' as const,
            className: 'whitespace-nowrap',
            cell: (employee: PublicEmployee) => (
              <>
                {/* Rendimiento no muestra inactivos (067 RN-8): el enlace
                    llevaría a un empleado que no está en el selector. */}
                {canSeePerformance && employee.isActive ? (
                  <Button asChild variant="outline">
                    <Link href={`/carwash/performance?employee=${employee.id}`}>
                      <ChartColumn
                        className="size-3.5 text-text-faint"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      Ver rendimiento
                      <span className="sr-only"> de {employee.fullName}</span>
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(employee);
                    setOpen(true);
                  }}
                >
                  {canManage ? (
                    <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                  ) : (
                    <Eye className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                  )}
                  {canManage ? 'Editar' : 'Ver'}
                  <span className="sr-only"> a {employee.fullName}</span>
                </Button>
              </>
            ),
          },
        ]}
      />

      <EmployeeDialog
        key={editing?.id ?? 'nuevo'}
        employee={editing}
        readOnly={!canManage}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
