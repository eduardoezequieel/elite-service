import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { MaintenanceScreen } from '@/features/fleet-maintenance/components/maintenance-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Mantenimiento · Elite Service',
  description: 'Qué le toca a cada carro de la flota, por km o por días.',
};

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="el mantenimiento de la flota" />}
    >
      <MaintenanceScreen
        initialPendingPage={pageParam(query.pendingPage)}
        initialMissingPage={pageParam(query.missingPage)}
      />
    </RequirePermission>
  );
}
