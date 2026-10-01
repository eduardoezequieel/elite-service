import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { MaintenanceScreen } from '@/features/fleet-maintenance/components/maintenance-screen';

export const metadata: Metadata = {
  title: 'Mantenimiento · Elite Service',
  description: 'Qué le toca a cada carro de la flota, por km o por días.',
};

export default function MaintenancePage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="el mantenimiento de la flota" />}
    >
      <MaintenanceScreen />
    </RequirePermission>
  );
}
