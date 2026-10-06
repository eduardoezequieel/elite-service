import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AgreementsScreen } from '@/features/rentals/components/agreements-screen';
import { pageParam, singleParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Rentas · Elite Service',
  description: 'Reservas, carros en la calle y rentas cerradas.',
};

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="las rentas" />}
    >
      <AgreementsScreen
        initialPage={pageParam(params.page)}
        initialStatus={singleParam(params.status)}
      />
    </RequirePermission>
  );
}
