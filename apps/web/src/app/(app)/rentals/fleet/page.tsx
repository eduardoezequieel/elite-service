import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FleetScreen } from '@/features/fleet/components/fleet-screen';
import { pageParam, singleParam } from '@/lib/list-params';

export const metadata: Metadata = { title: 'Carros · Elite Service' };

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="la flota" />}
    >
      <FleetScreen
        initialPage={pageParam(params.page)}
        initialRetired={singleParam(params.status) === 'RETIRED'}
      />
    </RequirePermission>
  );
}
