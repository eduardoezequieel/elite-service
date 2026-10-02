import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { VehicleMaintenanceTab } from '@/features/fleet-maintenance/components/vehicle-maintenance-tab';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = { title: 'Mantenimiento del carro · Elite Service' };

export default async function FleetVehicleMaintenancePage({
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
      fallback={<PermissionDenied screen="el mantenimiento del carro" />}
    >
      <VehicleMaintenanceTab id={id} initialPage={pageParam(query.page)} />
    </RequirePermission>
  );
}
