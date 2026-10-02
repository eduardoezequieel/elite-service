'use client';

import { BANK_ACCOUNT_TYPE_LABELS, type BankAccount } from '@elite/shared';
import { Pencil, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DeactivateConfirmDialog } from '@/components/ui/deactivate-confirm-dialog';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Stamp } from '@/components/ui/stamp';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { useListPage } from '@/features/inventory/hooks/use-list-page';
import { activityFlag, activityOptions, countActiveFilters } from '@/lib/list-filters';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import { cn } from '@/lib/utils';
import { useBankAccounts, useUpdateBankAccount } from '../hooks/use-bank-accounts';
import { BankAccountDialog } from './bank-account-dialog';

/**
 * `/settings/bank-accounts` (spec 069): las cuentas del negocio a las que entra
 * una transferencia. Mismo patrón que `/settings/employees`: tabla del sistema,
 * sin borrar —se desactivan (RN-3)— y la inactiva lleva la regla de anulación
 * sobre el banco con su sello, nunca opacidad.
 *
 * La página ya exige `banking.manage`, así que acá todo es editable.
 */
export function BankAccountsScreen({ initialPage = 1 }: { initialPage?: number }) {
  const update = useUpdateBankAccount();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  // Se guarda el id y la cuenta se relee de la consulta (051).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const extra = useFilterValues(['active'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  // El estado lo filtra el API (102): la página ya viene recortada.
  const [page, setPage] = useListPage(initialPage, extra.values.active);
  const accounts = useBankAccounts({
    active: activityFlag(extra.values.active),
    page,
    pageSize: LIST_PAGE_SIZE,
  });
  // ¿Hay alguna? Sin filtro: decide si el botón va arriba o en el vacío.
  const any = useBankAccounts({ pageSize: 1 });
  const hasAny = (any.data?.total ?? 0) > 0;
  const rows = accounts.data?.items ?? [];
  const editing = rows.find((account) => account.id === editingId);
  const deactivating = rows.find((account) => account.id === deactivatingId);

  function setActive(account: BankAccount, active: boolean): void {
    update.mutate(
      { id: account.id, input: { active } },
      {
        onSuccess: (saved) => {
          toast({
            title: active ? 'Cuenta activada' : 'Cuenta desactivada',
            description: saved.bankName,
          });
          setDeactivatingId(null);
        },
      },
    );
  }

  const newButton = (
    <Button type="button" onClick={() => setCreating(true)}>
      Nueva cuenta
    </Button>
  );

  return (
    <div>
      <ScreenHeader
        title="Cuentas bancarias"
        subtitle="Las cuentas del negocio a las que puede entrar una transferencia"
      >
        {hasAny ? newButton : null}
      </ScreenHeader>

      <FilterBar className="mb-4">
        <FiltersPopover
          fields={[
            {
              id: 'active',
              label: 'Estado',
              value: extra.values.active,
              options: activityOptions('Todos los estados', 'Activas', 'Inactivas'),
              onChange: (value) => extra.set('active', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      {/* Un activar que falló se dice acá, arriba de la lista (convención 16).
          El de desactivar lo dice su confirmación. */}
      {update.error !== null && deactivating === undefined ? (
        <p className="text-danger-text text-body mb-4" role="alert">
          {update.error.message}
        </p>
      ) : null}

      <DataTable
        rows={rows}
        rowKey={(account) => account.id}
        reference={(_account, index) => pagedReference(accounts.data, index)}
        isLoading={accounts.isPending}
        errorMessage={accounts.error?.message ?? null}
        emptyTitle={extraActive > 0 ? 'Ninguna cuenta coincide' : 'Todavía no hay cuentas'}
        emptyMessage={
          extraActive > 0
            ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
            : 'Registrá la primera para poder cobrar por transferencia.'
        }
        emptyAction={any.data !== undefined && !hasAny ? newButton : undefined}
        columns={[
          {
            key: 'bank',
            header: 'Banco',
            stack: 'title',
            // Titular se lleva el sobrante (`w-full`); sin piso, «Banco Agrícola» se partía en dos.
            headerClassName: 'min-w-50',
            cell: (account) => (
              <span className={cn('text-body font-semibold', !account.active && 'is-ruled-out')}>
                {account.bankName}
              </span>
            ),
          },
          {
            key: 'type',
            header: 'Tipo',
            className: 'whitespace-nowrap',
            cell: (account) => (
              <span className="text-text-dim">{BANK_ACCOUNT_TYPE_LABELS[account.type]}</span>
            ),
          },
          {
            key: 'number',
            header: 'Número',
            className: 'whitespace-nowrap',
            cell: (account) => <span className="font-mono">{account.number}</span>,
          },
          {
            key: 'holder',
            header: 'Titular',
            headerClassName: 'w-full',
            cell: (account) => <span className="text-text-dim">{account.holderName}</span>,
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (account) =>
              account.active ? (
                <Stamp tone="green" label="Activa" />
              ) : (
                <Stamp tone="neutral" label="Inactiva" />
              ),
          },
          {
            key: 'actions',
            header: 'Acciones',
            stack: 'actions',
            className: 'whitespace-nowrap',
            cell: (account) => (
              <>
                <Button type="button" variant="outline" onClick={() => setEditingId(account.id)}>
                  <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                  Editar
                  <span className="sr-only"> la cuenta {account.number}</span>
                </Button>
                {account.active ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      update.reset();
                      setDeactivatingId(account.id);
                    }}
                  >
                    <PowerOff className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                    Desactivar
                    <span className="sr-only"> la cuenta {account.number}</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    loading={update.isPending && update.variables?.id === account.id}
                    onClick={() => setActive(account, true)}
                  >
                    <Power className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                    Activar
                    <span className="sr-only"> la cuenta {account.number}</span>
                  </Button>
                )}
              </>
            ),
          },
        ]}
      />

      <div className="mt-4">
        <Pager
          page={accounts.data}
          noun={{ one: 'cuenta', many: 'cuentas' }}
          onPageChange={setPage}
        />
      </div>

      {creating ? <BankAccountDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <BankAccountDialog account={editing} onClose={() => setEditingId(null)} /> : null}

      <DeactivateConfirmDialog
        open={deactivating !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeactivatingId(null);
        }}
        title={`¿Desactivar la cuenta ${deactivating?.number ?? ''}?`}
        description="Deja de salir en el cobro. Los pagos que ya entraron a esta cuenta la siguen mostrando, y se puede volver a activar."
        loading={update.isPending}
        error={update.error?.message ?? null}
        onConfirm={() => {
          if (deactivating !== undefined) setActive(deactivating, false);
        }}
      />
    </div>
  );
}
