import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FleetExpensesScreen } from '@/features/fleet-maintenance/components/fleet-expenses-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Gastos · Elite Service',
  description: 'Los gastos de cada carro: anotados, lavados del carwash y multas no cargadas.',
};

export default async function FleetExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="los gastos de la flota" />}
    >
      <FleetExpensesScreen initialPage={pageParam(query.page)} />
    </RequirePermission>
  );
}
