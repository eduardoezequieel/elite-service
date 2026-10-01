import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FleetScreen } from '@/features/fleet/components/fleet-screen';

export const metadata: Metadata = {
  title: 'Flota · Elite Service',
  description: 'Los carros de la rentadora, con su tarifa y su estado.',
};

export default function FleetPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="la flota" />}
    >
      <FleetScreen />
    </RequirePermission>
  );
}
