'use client';

import { FLEET_EXPENSE_TYPE_LABELS, PERMISSIONS } from '@elite/shared';
import type { FleetExpenseRow } from '@elite/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { formatCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { useFleetExpenses } from '../hooks/use-fleet-maintenance';
import { ExpenseEntryDialog } from './expense-entry-dialog';

/** Gastos por página (101). */
const PAGE_SIZE = 25;

function whatOf(row: FleetExpenseRow): string {
  const text = row.description?.trim();

  return text !== undefined && text !== '' ? text : FLEET_EXPENSE_TYPE_LABELS[row.type];
}

/**
 * Los gastos de un carro (110): fecha, qué y monto. Lavado y multa no cargada
 * salen marcados «Automático». Anotar no pregunta la categoría.
 */
export function VehicleExpensesTab({ id, initialPage = 1 }: { id: string; initialPage?: number }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const [page, setPage] = useUrlPage('page', initialPage, id);
  const expenses = useFleetExpenses({ vehicleId: id, page, pageSize: PAGE_SIZE });
  const [entry, setEntry] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div>
          <Button type="button" onClick={() => setEntry(true)}>
            Anotar gasto
          </Button>
        </div>
      ) : null}

      <DataTable<FleetExpenseRow>
        rows={expenses.data?.items ?? []}
        rowKey={(row) => `${row.source}:${row.id}`}
        reference={(_, index) => pagedReference(expenses.data, index)}
        isLoading={expenses.isPending}
        errorMessage={expenses.error?.message ?? null}
        emptyTitle="Sin gastos"
        emptyMessage=""
        columns={[
          {
            key: 'date',
            header: 'Fecha',
            stack: 'title',
            cell: (row) => <span className="tabular-nums">{formatCivil(row.incurredAt)}</span>,
          },
          {
            key: 'what',
            header: 'Qué',
            className: 'whitespace-normal',
            cell: (row) => (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-body">{whatOf(row)}</span>
                {row.source === 'CARWASH' || row.source === 'FINE' ? (
                  <Stamp label="Automático" tone="neutral" />
                ) : null}
              </span>
            ),
          },
          {
            key: 'amount',
            header: 'Monto',
            align: 'right',
            cell: (row) => (
              <span className="font-mono tabular-nums">{formatMoney(row.amount)}</span>
            ),
          },
        ]}
      />
      <Pager page={expenses.data} noun={{ one: 'gasto', many: 'gastos' }} onPageChange={setPage} />

      {entry ? <ExpenseEntryDialog vehicleId={id} onClose={() => setEntry(false)} /> : null}
    </div>
  );
}
