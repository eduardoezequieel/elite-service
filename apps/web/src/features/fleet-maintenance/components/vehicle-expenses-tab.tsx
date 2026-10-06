'use client';

import { FLEET_EXPENSE_TYPE_LABELS, PERMISSIONS } from '@elite/shared';
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
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FormAlert } from '@/features/inventory/components/form-fields';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { formatCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { useDeleteFleetExpense, useFleetExpenses } from '../hooks/use-fleet-maintenance';
import { ExpenseEntryDialog } from './expense-entry-dialog';

/** Gastos por página (101). */
const PAGE_SIZE = 25;

function whatOf(row: FleetExpenseRow): string {
  const text = row.description?.trim();

  return text !== undefined && text !== '' ? text : FLEET_EXPENSE_TYPE_LABELS[row.type];
}

/**
 * Los gastos de un carro (110): fecha, qué y monto. Lavado y multa no cargada
 * salen marcados «Automático». Uno anotado a mano se corrige o se borra; el
 * que sale de un servicio, no.
 */
export function VehicleExpensesTab({ id, initialPage = 1 }: { id: string; initialPage?: number }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.fleet.actions.manage.key);
  const [page, setPage] = useUrlPage('page', initialPage, id);
  const expenses = useFleetExpenses({ vehicleId: id, page, pageSize: PAGE_SIZE });
  const [entry, setEntry] = useState(false);
  const [editing, setEditing] = useState<FleetExpenseRow | null>(null);
  const [removing, setRemoving] = useState<FleetExpenseRow | null>(null);

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
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: '',
                  align: 'right' as const,
                  stack: 'actions' as const,
                  cell: (row: FleetExpenseRow) =>
                    row.editable ? (
                      <ExpenseActions row={row} onEdit={setEditing} onRemove={setRemoving} />
                    ) : null,
                },
              ]
            : []),
        ]}
      />
      <Pager page={expenses.data} noun={{ one: 'gasto', many: 'gastos' }} onPageChange={setPage} />

      {entry ? <ExpenseEntryDialog vehicleId={id} onClose={() => setEntry(false)} /> : null}
      {editing !== null ? (
        <ExpenseEntryDialog
          key={editing.id}
          vehicleId={id}
          expense={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {removing !== null ? (
        <DeleteExpenseDialog row={removing} onClose={() => setRemoving(null)} />
      ) : null}
    </div>
  );
}

function ExpenseActions({
  row,
  onEdit,
  onRemove,
}: {
  row: FleetExpenseRow;
  onEdit: (row: FleetExpenseRow) => void;
  onRemove: (row: FleetExpenseRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Acciones del gasto">
          <MoreHorizontal className="size-icon" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(row)}>Corregir</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRemove(row)}>Borrar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteExpenseDialog({ row, onClose }: { row: FleetExpenseRow; onClose: () => void }) {
  const remove = useDeleteFleetExpense();
  const { toast } = useToast();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Borrar este gasto?</DialogTitle>
          <DialogDescription>{whatOf(row)}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FormAlert message={remove.error?.message ?? null} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructiveSolid"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(row.id, {
                onSuccess: () => {
                  toast({ title: 'Gasto borrado' });
                  onClose();
                },
              })
            }
          >
            Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
