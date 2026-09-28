import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { EmployeeConsumptionScreen } from '@/features/inventory/components/employee-consumption-screen';
import { consumptionRangeFrom } from '@/features/inventory/consumption';

export const metadata: Metadata = { title: 'Consumo · Elite Service' };

export default async function EmployeeConsumptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employeeId } = await params;
  const query = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.inventory.actions.read.key}
      fallback={<PermissionDenied screen="los consumos del personal" />}
    >
      <EmployeeConsumptionScreen
        employeeId={employeeId}
        initialRange={consumptionRangeFrom(query)}
      />
    </RequirePermission>
  );
}
