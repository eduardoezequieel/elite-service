'use client';

import { useState } from 'react';

import { DataTable } from '@/components/ui/data-table';
import { FilterChip } from '@/components/ui/filter-chip';
import { Pager } from '@/features/inventory/components/pager';
import { todayCivil } from '@/lib/civil-date';
import { replaceParam } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useUrlPage } from '@/lib/use-url-page';
import { operationFilter, operationQuery, type OperationFilter } from '../agreement-format';
import { useAgreements } from '../hooks/use-agreements';
import { agreementReference, operationColumns } from './agreement-columns';
import { AgreementSearch, BAHIA_CARDS, FILTER_CHIP_SPREAD } from './agreement-list-parts';

const PAGE_SIZE = 25;

const CHIPS: { filter: OperationFilter; label: string }[] = [
  { filter: 'RESERVED', label: 'Por salir' },
  { filter: 'IN_PROGRESS', label: 'En la calle' },
  { filter: 'FINISHED', label: 'Ya volvió' },
];

function emptyTitle(filter: OperationFilter, searching: boolean): string {
  if (searching) return 'Sin resultados';
  if (filter === 'RESERVED') return 'Nada por salir';
  if (filter === 'IN_PROGRESS') return 'Nadie en la calle';
  return 'Nada devuelto';
}

/**
 * El tab Rentas (117): lo que pasa ahora. El buscador primero y, debajo, tres
 * filtros con su cantidad. Por defecto, las que están en la calle. El filtro
 * vive en `?status=`. Lo cerrado hace rato y lo cancelado van al Historial.
 */
export function AgreementsScreen({
  initialPage = 1,
  initialStatus = null,
}: {
  initialPage?: number;
  initialStatus?: string | null;
}) {
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const [filter, setFilter] = useState<OperationFilter>(() => operationFilter(initialStatus));
  const [today] = useState(() => todayCivil());
  const [now] = useState(() => new Date());
  const columns = operationColumns(now);

  const [page, setPage] = useUrlPage('page', initialPage, JSON.stringify({ filter, search }));
  const agreements = useAgreements({
    ...operationQuery(filter, today),
    ...(search === '' ? {} : { q: search }),
    page,
    pageSize: PAGE_SIZE,
  });

  // Solo el total de cada filtro: una fila basta (102).
  const reserved = useAgreements({ ...operationQuery('RESERVED', today), pageSize: 1 });
  const out = useAgreements({ ...operationQuery('IN_PROGRESS', today), pageSize: 1 });
  const back = useAgreements({ ...operationQuery('FINISHED', today), pageSize: 1 });
  const counts: Record<OperationFilter, number | undefined> = {
    RESERVED: reserved.data?.total,
    IN_PROGRESS: out.data?.total,
    FINISHED: back.data?.total,
  };

  function choose(next: OperationFilter) {
    setFilter(next);
    replaceParam('status', next === 'IN_PROGRESS' ? null : next);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <AgreementSearch
          id="agreement-search"
          value={term}
          onChange={setTerm}
          placeholder="Placa o cliente"
        />

        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => (
            <FilterChip
              key={chip.filter}
              pressed={filter === chip.filter}
              count={counts[chip.filter]}
              className={FILTER_CHIP_SPREAD}
              onClick={() => choose(chip.filter)}
            >
              {chip.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className={BAHIA_CARDS}>
        <DataTable
          rows={agreements.data?.items ?? []}
          rowKey={(agreement) => agreement.id}
          reference={agreementReference}
          rowHref={(agreement) => `/rentals/agreements/${agreement.id}`}
          isLoading={agreements.isPending}
          errorMessage={agreements.error?.message ?? null}
          emptyTitle={emptyTitle(filter, search !== '')}
          emptyMessage=""
          columns={columns}
        />
      </div>

      <Pager
        page={agreements.data}
        noun={{ one: 'renta', many: 'rentas' }}
        onPageChange={setPage}
      />
    </div>
  );
}
