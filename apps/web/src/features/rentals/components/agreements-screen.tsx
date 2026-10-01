'use client';

import { AGREEMENT_DERIVED_STATUSES, AGREEMENT_STATUS_LABELS, PERMISSIONS } from '@elite/shared';
import type { AgreementDerivedStatus, AgreementsQuery } from '@elite/shared';
import { Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DateRangeField } from '@/components/ui/date-field';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { presetRange, type CivilRange } from '@/lib/civil-date';
import { isAll, withAllOption } from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useAgreements } from '../hooks/use-agreements';
import { agreementColumns, agreementReference } from './agreement-columns';

const STATUS_OPTIONS = withAllOption(
  'Todos los estados',
  AGREEMENT_DERIVED_STATUSES.map((status) => ({
    value: status,
    label: AGREEMENT_STATUS_LABELS[status],
  })),
);

/** El estado elegido a la query: «Atrasada» es la bandera `late`, no un estado guardado. */
export function statusQuery(value: string): Pick<AgreementsQuery, 'status' | 'late'> {
  if (isAll(value)) return {};
  if (value === 'LATE') return { late: true };
  return { status: [value as Exclude<AgreementDerivedStatus, 'LATE'>] };
}

const COLUMNS = agreementColumns();

/**
 * Rentas (096): todas, la más reciente arriba. Filtros por estado y rango;
 * búsqueda por cliente, placa o número de contrato.
 */
export function AgreementsScreen() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const filters = useFilterValues(['status'] as const);
  const [range, setRange] = useState<CivilRange | null>(null);

  const query: AgreementsQuery = {
    ...statusQuery(filters.values.status),
    ...(search === '' ? {} : { q: search }),
    ...(range === null ? {} : { from: range.from, to: range.to }),
  };
  const agreements = useAgreements(query);
  const filtering = Object.keys(query).length > 0;

  const newButton = canManage ? (
    <Button asChild>
      <Link href="/rentals/agreements/new">
        <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
        Nueva renta
      </Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Rentas"
        subtitle={
          agreements.data
            ? `${agreements.data.length} ${agreements.data.length === 1 ? 'renta' : 'rentas'}`
            : ' '
        }
      >
        {newButton}
      </ScreenHeader>

      <FilterBar>
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="agreement-search">Buscar por cliente, placa o contrato</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="agreement-search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Ana López, P53DBC o 733"
                autoComplete="off"
              />
            </div>
          </FieldBox>
        </div>
        <div className="flex items-center gap-1.5">
          <DateRangeField
            value={range ?? presetRange('month')}
            onChange={setRange}
            aria-label="Rentas que tocan este rango"
          />
          {range === null ? null : (
            <Button type="button" variant="ghost" size="icon" onClick={() => setRange(null)}>
              <X className="size-icon" strokeWidth={1.5} aria-hidden />
              <span className="sr-only">Quitar el rango</span>
            </Button>
          )}
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
      {range === null ? (
        <p className="text-text-faint -mt-2 text-dense">
          Todas las fechas. Elegí un rango para ver solo las rentas que lo tocan.
        </p>
      ) : null}

      <DataTable
        rows={agreements.data ?? []}
        rowKey={(agreement) => agreement.id}
        reference={agreementReference}
        rowHref={(agreement) => `/rentals/agreements/${agreement.id}`}
        isLoading={agreements.isPending}
        errorMessage={agreements.error?.message ?? null}
        pageSize={25}
        emptyTitle={filtering ? 'Ninguna renta coincide' : 'Todavía no hay rentas'}
        emptyMessage={
          filtering
            ? 'Probá con otra búsqueda, otro rango o restablecé los filtros.'
            : 'Reservá la primera con «Nueva renta».'
        }
        emptyAction={filtering ? undefined : (newButton ?? undefined)}
        columns={COLUMNS}
      />
    </div>
  );
}
