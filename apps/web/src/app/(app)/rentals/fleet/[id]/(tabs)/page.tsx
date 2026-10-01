import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FleetVehicleDetail } from '@/features/fleet/components/fleet-vehicle-detail';

export const metadata: Metadata = { title: 'Carro · Elite Service' };

export default async function FleetVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="la ficha del carro" />}
    >
      <FleetVehicleDetail id={id} />
    </RequirePermission>
  );
}
