import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VehicleMonthsTab } from '@/features/rental-reports/components/vehicle-months-tab';

export const metadata: Metadata = { title: '¿Cuánto dejó? · Elite Service' };

export default async function FleetVehicleMonthsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.reports.key}
      fallback={<PermissionDenied screen="cuánto dejó el carro" />}
    >
      <VehicleMonthsTab id={id} />
    </RequirePermission>
  );
}
