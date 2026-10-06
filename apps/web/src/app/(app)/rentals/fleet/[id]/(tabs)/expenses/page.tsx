import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VehicleExpensesTab } from '@/features/fleet-maintenance/components/vehicle-expenses-tab';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = { title: 'Gastos del carro · Elite Service' };

export default async function FleetVehicleExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="los gastos del carro" />}
    >
      <VehicleExpensesTab id={id} initialPage={pageParam(query.page)} />
    </RequirePermission>
  );
}
