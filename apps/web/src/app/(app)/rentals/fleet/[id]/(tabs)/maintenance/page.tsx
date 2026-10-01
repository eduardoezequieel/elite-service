import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VehicleMaintenanceTab } from '@/features/fleet-maintenance/components/vehicle-maintenance-tab';

export const metadata: Metadata = { title: 'Mantenimiento del carro · Elite Service' };

export default async function FleetVehicleMaintenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="el mantenimiento del carro" />}
    >
      <VehicleMaintenanceTab id={id} />
    </RequirePermission>
  );
}
