'use client';

import { PERMISSIONS } from '@elite/shared';
import { Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DateRangeField } from '@/components/ui/date-field';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldBox } from '@/components/ui/field-box';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Pager } from '@/features/inventory/components/pager';
import { todayCivil, type CivilRange } from '@/lib/civil-date';
import { replaceParam } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useUrlPage } from '@/lib/use-url-page';
import type { AgreementsParams } from '../api';
import {
  agreementListFilter,
  agreementListQuery,
  type AgreementListFilter,
} from '../agreement-format';
import { useAgreements } from '../hooks/use-agreements';
import { agreementListColumns, agreementReference } from './agreement-columns';

const COLUMNS = agreementListColumns();
const PAGE_SIZE = 25;

const CHIPS: { filter: AgreementListFilter; label: string }[] = [
  { filter: 'RESERVED', label: 'Por salir' },
  { filter: 'IN_PROGRESS', label: 'En la calle' },
  { filter: 'FINISHED', label: 'Ya volvió' },
];

function emptyTitle(filter: AgreementListFilter, searching: boolean): string {
  if (searching) return 'Sin resultados';
  if (filter === 'RESERVED') return 'Nada por salir';
  if (filter === 'IN_PROGRESS') return 'Nadie en la calle';
  if (filter === 'FINISHED') return 'Nada devuelto';
  if (filter === 'CANCELLED') return 'Nada cancelado';
  return 'Nada';
}

/**
 * Rentas (108): tres filtros, búsqueda y fechas. Por defecto, las que están
 * en la calle. El filtro vive en `?status=`; «Todas» es `ALL` y no viaja al API.
 */
export function AgreementsScreen({
  initialPage = 1,
  initialStatus = null,
}: {
  initialPage?: number;
  initialStatus?: string | null;
}) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const [filter, setFilter] = useState<AgreementListFilter>(() => agreementListFilter(initialStatus));
  const [range, setRange] = useState<CivilRange | null>(null);
  const today = todayCivil();

  const query: AgreementsParams = {
    ...agreementListQuery(filter),
    ...(search === '' ? {} : { q: search }),
    ...(range === null ? {} : { from: range.from, to: range.to }),
  };
  const [page, setPage] = useUrlPage(
    'page',
    initialPage,
    JSON.stringify({ filter, search, range }),
  );
  const agreements = useAgreements({ ...query, page, pageSize: PAGE_SIZE });

  function choose(next: AgreementListFilter) {
    setFilter(next);
    replaceParam('status', next === 'IN_PROGRESS' ? null : next);
  }

  const newButton = canManage ? (
    <Button asChild>
      <Link href="/rentals/agreements/new">
        <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
        Nueva renta
      </Link>
    </Button>
  ) : null;
  const morePressed = filter === 'ALL' || filter === 'CANCELLED';

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Rentas">{newButton}</ScreenHeader>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => (
            <FilterChip
              key={chip.filter}
              pressed={filter === chip.filter}
              onClick={() => choose(chip.filter)}
            >
              {chip.label}
            </FilterChip>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterChip pressed={morePressed}>Más</FilterChip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => choose('ALL')}>Todas</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => choose('CANCELLED')}>Canceladas</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 max-w-md flex-1">
            <FieldBox className="h-full">
              <Label htmlFor="agreement-search">Buscar</Label>
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
                  placeholder="Placa o cliente"
                  autoComplete="off"
                />
              </div>
            </FieldBox>
          </div>
          <div className="flex items-center gap-1.5">
            <DateRangeField
              value={range ?? { from: today, to: today }}
              triggerLabel={range === null ? 'Todas las fechas' : undefined}
              onChange={setRange}
              aria-label="Fechas"
            />
            {range === null ? null : (
              <Button type="button" variant="ghost" size="icon" onClick={() => setRange(null)}>
                <X className="size-icon" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">Quitar el rango</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="[[data-density=bahia]_&]:[&_[data-layout=table]]:!hidden [[data-density=bahia]_&]:[&_[data-layout=cards]]:!flex">
        <DataTable
          rows={agreements.data?.items ?? []}
          rowKey={(agreement) => agreement.id}
          reference={agreementReference}
          rowHref={(agreement) => `/rentals/agreements/${agreement.id}`}
          isLoading={agreements.isPending}
          errorMessage={agreements.error?.message ?? null}
          emptyTitle={emptyTitle(filter, search !== '')}
          emptyMessage=""
          columns={COLUMNS}
        />
      </div>

      <Pager page={agreements.data} noun={{ one: 'renta', many: 'rentas' }} onPageChange={setPage} />
    </div>
  );
}
