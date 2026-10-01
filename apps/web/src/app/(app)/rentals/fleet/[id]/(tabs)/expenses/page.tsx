import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VehicleExpensesTab } from '@/features/fleet-maintenance/components/fleet-expenses-screen';

export const metadata: Metadata = { title: 'Gastos del carro · Elite Service' };

export default async function FleetVehicleExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="los gastos del carro" />}
    >
      <VehicleExpensesTab id={id} />
    </RequirePermission>
  );
}
