'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Renter } from '@elite/shared';
import { FileUp, Pencil, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { activityOptions, isAll, withAllOption } from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useRenters } from '../hooks/use-renters';
import { RenterDialog } from './renter-dialog';
import { RenterImportDialog } from './renter-import-dialog';
import { RenterStamps } from './renter-stamps';

const ACTIVITY_OPTIONS = activityOptions('Activos e inactivos', 'Activos', 'Inactivos');
const BLOCKED_OPTIONS = withAllOption('Con y sin bloqueo', [
  { value: 'blocked', label: 'No rentar' },
  { value: 'allowed', label: 'Se les renta' },
]);

function countsLabel(total: number): string {
  return total === 1 ? '1 cliente' : `${total} clientes`;
}

/** El valor de un filtro a la bandera de la query: «todos» es no mandar nada. */
function flagOf(value: string, truthy: string): boolean | undefined {
  return isAll(value) ? undefined : value === truthy;
}

/**
 * Clientes de la rentadora (095). Otra lista que los del lavado: tienen lo que
 * pide el contrato y pueden quedar marcados «No rentar».
 */
export function RentersScreen() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.renters.actions.read.key);
  const canManage = can(PERMISSIONS.renters.actions.manage.key);

  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const filters = useFilterValues(['active', 'blocked'] as const);
  const active = flagOf(filters.values.active, 'active');
  const blocked = flagOf(filters.values.blocked, 'blocked');

  const renters = useRenters({ q: search === '' ? undefined : search, active, blocked }, canRead);
  const all = useRenters({}, canRead);
  const filtering = search !== '' || active !== undefined || blocked !== undefined;

  const [dialog, setDialog] = useState<Renter | 'new' | null>(null);
  const [importing, setImporting] = useState(false);

  const newRenterButton = canManage ? (
    <Button type="button" onClick={() => setDialog('new')}>
      <UserPlus className="size-icon" strokeWidth={1.5} aria-hidden />
      Nuevo cliente
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Clientes"
        subtitle={all.data ? `${countsLabel(all.data.length)} de renta` : '\u00a0'}
      >
        {canManage ? (
          <Button type="button" variant="outline" onClick={() => setImporting(true)}>
            <FileUp className="size-icon text-text-faint" strokeWidth={1.5} aria-hidden />
            Importar CSV
          </Button>
        ) : null}
        {(all.data?.length ?? 0) > 0 ? newRenterButton : null}
      </ScreenHeader>

      <FilterBar>
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="renter-search">Buscar por nombre, documento, licencia o teléfono</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="renter-search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Ana López o 01234567-8"
                autoComplete="off"
              />
            </div>
          </FieldBox>
        </div>
        <FiltersPopover
          fields={[
            {
              id: 'active',
              label: 'Actividad',
              value: filters.values.active,
              options: ACTIVITY_OPTIONS,
              onChange: (value) => filters.set('active', value),
            },
            {
              id: 'blocked',
              label: 'No rentar',
              value: filters.values.blocked,
              options: BLOCKED_OPTIONS,
              onChange: (value) => filters.set('blocked', value),
            },
          ]}
          onReset={filters.reset}
        />
      </FilterBar>

      <DataTable
        rows={renters.data ?? []}
        rowKey={(renter) => renter.id}
        rowHref={(renter) => `/rentals/customers/${renter.id}`}
        isLoading={renters.isPending}
        errorMessage={renters.error?.message ?? null}
        emptyTitle={filtering ? 'Nadie coincide' : 'Todavía no hay clientes de renta'}
        emptyMessage={
          filtering
            ? 'Probá con otra búsqueda o restablecé los filtros.'
            : 'Cargá el primero con «Nuevo cliente» o traelos de tu Excel con «Importar CSV».'
        }
        emptyAction={filtering ? undefined : (newRenterButton ?? undefined)}
        columns={[
          {
            key: 'name',
            header: 'Nombre',
            headerClassName: 'w-full',
            stack: 'title',
            cell: (renter) => <span className="text-body font-semibold">{renter.fullName}</span>,
          },
          {
            key: 'document',
            header: 'Documento',
            className: 'whitespace-nowrap',
            cell: (renter) => (
              <span className="text-text-dim font-mono text-dense">{renter.documentId ?? '—'}</span>
            ),
          },
          {
            key: 'phone',
            header: 'Celular',
            className: 'whitespace-nowrap',
            cell: (renter) => (
              <span className="text-text-dim font-mono text-dense">
                {renter.mobilePhone ?? renter.phone ?? '—'}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (renter) => <RenterStamps renter={renter} />,
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: 'Acciones',
                  stack: 'actions' as const,
                  className: 'whitespace-nowrap',
                  cell: (renter: Renter) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog(renter)}
                    >
                      <Pencil className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
                      Editar
                      <span className="sr-only"> a {renter.fullName}</span>
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {dialog === null ? null : (
        <RenterDialog
          renter={dialog === 'new' ? undefined : dialog}
          onClose={() => setDialog(null)}
        />
      )}
      {importing ? <RenterImportDialog onClose={() => setImporting(false)} /> : null}
    </div>
  );
}
