'use client';

import { PERMISSIONS } from '@elite/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useAgreements } from '../hooks/use-agreements';
import { agreementColumns, agreementReference } from './agreement-columns';

const COLUMNS = agreementColumns({ withCustomer: false });

/**
 * El historial de rentas de un cliente, en su ficha (095/096): cada renta con
 * su carro, fechas, estado y saldo. Sin `rentals.read` no se dibuja: la ficha
 * del cliente se puede ver sin ver las rentas.
 */
export function RenterHistory({ customerId }: { customerId: string }) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.rentals.actions.read.key);
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const agreements = useAgreements({ customerId }, canRead);

  if (!canRead) return null;

  const newButton = canManage ? (
    <Button asChild variant="outline" size="sm">
      <Link href={`/rentals/agreements/new?customerId=${customerId}`}>
        <Plus className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
        Nueva renta
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-text">Historial de rentas</h2>
        {(agreements.data?.length ?? 0) > 0 ? newButton : null}
      </div>
      <DataTable
        rows={agreements.data ?? []}
        rowKey={(agreement) => agreement.id}
        reference={agreementReference}
        rowHref={(agreement) => `/rentals/agreements/${agreement.id}`}
        isLoading={agreements.isPending}
        errorMessage={agreements.error?.message ?? null}
        pageSize={10}
        emptyTitle="Sin rentas todavía"
        emptyMessage="Cuando le rentes un carro, aparece acá con su estado y su saldo."
        emptyAction={newButton ?? undefined}
        columns={COLUMNS}
      />
    </>
  );
}
