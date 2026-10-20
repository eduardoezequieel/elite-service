'use client';

import { formatKm } from '@elite/shared';
import type { FleetExpenseRow } from '@elite/shared';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterChip } from '@/components/ui/filter-chip';
import { Stamp } from '@/components/ui/stamp';
import { FormAlert } from '@/features/inventory/components/form-fields';
import { formatCivil, todayCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import {
  expenseTitle,
  historyHasMore,
  mergeHistory,
  monthRange,
  type HistoryFilter,
  type HistoryRow,
} from '../care-history';
import {
  useDeleteFleetExpense,
  useDeleteMaintenanceLog,
  useFleetExpensePages,
  useMaintenanceLogPages,
} from '../hooks/use-fleet-maintenance';
import { ExpenseEntryDialog } from './expense-entry-dialog';

/** Filas por página de cada lista del historial. */
const PAGE_SIZE = 25;

type Removing =
  { kind: 'service'; logId: string; title: string } | { kind: 'expense'; row: FleetExpenseRow };

/**
 * El historial de un carro (122): servicios y gastos juntos en un panel
 * lateral, del más nuevo al más viejo, con el total gastado del filtro.
 */
export function CareHistoryDrawer({
  vehicleId,
  canManage,
  onClose,
}: {
  vehicleId: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<HistoryFilter>('month');
  const range = filter === 'month' ? monthRange(todayCivil()) : null;
  const logs = useMaintenanceLogPages({ vehicleId, pageSize: PAGE_SIZE });
  const expenses = useFleetExpensePages({
    vehicleId,
    pageSize: PAGE_SIZE,
    ...(range === null ? {} : range),
  });
  const [editing, setEditing] = useState<FleetExpenseRow | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);

  const logItems = logs.data?.pages.flatMap((page) => page.items) ?? [];
  const expenseItems = expenses.data?.pages.flatMap((page) => page.items) ?? [];
  const rows = mergeHistory(logItems, expenseItems, range);
  const total = expenses.data?.pages[0]?.totalAmount ?? '0.00';
  const more = historyHasMore({
    logs: logItems,
    logsHasMore: logs.hasNextPage,
    expensesHasMore: expenses.hasNextPage,
    range,
  });
  const loadingMore = logs.isFetchingNextPage || expenses.isFetchingNextPage;

  function loadMore() {
    if (expenses.hasNextPage) void expenses.fetchNextPage();
    if (logs.hasNextPage) void logs.fetchNextPage();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          variant="drawer"
          className="md:inset-y-0 md:right-0 md:left-auto md:h-auto md:w-[min(640px,100%)] md:translate-x-0 md:rounded-none md:border-y-0 md:border-r-0 md:border-l"
        >
          <DialogHeader>
            <DialogTitle>Historial</DialogTitle>
            <DialogDescription className="sr-only">Servicios y gastos del carro</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-label text-text-dim">
                  {filter === 'month' ? 'Gastado este mes' : 'Gastado en total'}
                </p>
                <p className="text-figure tabular-nums">{formatMoney(total)}</p>
              </div>
              <div role="group" aria-label="Qué mostrar" className="flex gap-2">
                <FilterChip pressed={filter === 'month'} onClick={() => setFilter('month')}>
                  Este mes
                </FilterChip>
                <FilterChip pressed={filter === 'all'} onClick={() => setFilter('all')}>
                  Todo
                </FilterChip>
              </div>
            </div>

            <DataTable<HistoryRow>
              rows={rows}
              rowKey={(row) => row.key}
              isLoading={logs.isPending || expenses.isPending}
              errorMessage={logs.error?.message ?? expenses.error?.message ?? null}
              emptyTitle={filter === 'month' ? 'Nada este mes' : 'Nada todavía'}
              emptyMessage=""
              columns={[
                {
                  key: 'date',
                  header: 'Fecha',
                  cell: (row) => <span className="tabular-nums">{formatCivil(row.date)}</span>,
                },
                {
                  key: 'what',
                  header: 'Qué',
                  stack: 'title',
                  className: 'whitespace-normal',
                  cell: (row) => (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-body">{row.title}</span>
                      {row.kind === 'expense' && row.automatic ? (
                        <Stamp label="Automático" tone="neutral" />
                      ) : null}
                      {row.odometerKm === null ? null : (
                        <span className="text-text-faint text-dense tabular-nums">
                          {formatKm(row.odometerKm)} km
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Monto',
                  align: 'right',
                  cell: (row) =>
                    row.amount === null ? (
                      <span className="text-text-faint">Sin costo</span>
                    ) : (
                      <span className="font-mono tabular-nums">{formatMoney(row.amount)}</span>
                    ),
                },
                ...(canManage
                  ? [
                      {
                        key: 'actions',
                        header: 'Acciones',
                        align: 'right' as const,
                        stack: 'actions' as const,
                        cell: (row: HistoryRow) => (
                          <RowActions row={row} onEdit={setEditing} onRemove={setRemoving} />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {more ? (
              <div className="flex justify-center">
                <Button type="button" variant="outline" loading={loadingMore} onClick={loadMore}>
                  Cargar más
                </Button>
              </div>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {editing !== null ? (
        <ExpenseEntryDialog
          key={editing.id}
          vehicleId={vehicleId}
          expense={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {removing !== null ? (
        <DeleteHistoryDialog removing={removing} onClose={() => setRemoving(null)} />
      ) : null}
    </>
  );
}

function RowActions({
  row,
  onEdit,
  onRemove,
}: {
  row: HistoryRow;
  onEdit: (row: FleetExpenseRow) => void;
  onRemove: (removing: Removing) => void;
}) {
  if (row.kind === 'expense' && !row.expense.editable) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Acciones: ${row.title}`}>
          <MoreHorizontal className="size-icon" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.kind === 'expense' ? (
          <>
            <DropdownMenuItem onSelect={() => onEdit(row.expense)}>Corregir</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRemove({ kind: 'expense', row: row.expense })}>
              Borrar
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem
            onSelect={() => onRemove({ kind: 'service', logId: row.logId, title: row.title })}
          >
            Borrar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteHistoryDialog({ removing, onClose }: { removing: Removing; onClose: () => void }) {
  const removeLog = useDeleteMaintenanceLog();
  const removeExpense = useDeleteFleetExpense();
  const { toast } = useToast();
  const service = removing.kind === 'service';
  const failure = service ? removeLog.error : removeExpense.error;

  function confirm() {
    if (removing.kind === 'service') {
      removeLog.mutate(removing.logId, {
        onSuccess: () => {
          toast({ title: 'Servicio borrado' });
          onClose();
        },
      });
      return;
    }

    removeExpense.mutate(removing.row.id, {
      onSuccess: () => {
        toast({ title: 'Gasto borrado' });
        onClose();
      },
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? '¿Borrar este servicio?' : '¿Borrar este gasto?'}</DialogTitle>
          <DialogDescription>
            {removing.kind === 'service' ? removing.title : expenseTitle(removing.row)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormAlert message={failure?.message ?? null} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructiveSolid"
            loading={removeLog.isPending || removeExpense.isPending}
            onClick={confirm}
          >
            Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
