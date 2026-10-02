import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FleetScreen } from '@/features/fleet/components/fleet-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Flota · Elite Service',
  description: 'Los carros de la rentadora, con su tarifa y su estado.',
};

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
      <FleetScreen initialPage={pageParam(params.page)} />
    </RequirePermission>
  );
}
