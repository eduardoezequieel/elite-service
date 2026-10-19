import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { HistoryScreen } from '@/features/rentals/components/history-screen';
import { pageParam, singleParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Historial · Elite Service',
  description: 'Rentas cerradas y canceladas, por mes.',
};

export default async function AgreementsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="el historial de rentas" />}
    >
      <HistoryScreen
        initialPage={pageParam(params.page)}
        initialMonth={singleParam(params.month)}
        initialStatus={singleParam(params.status)}
        initialVehicle={singleParam(params.vehicle)}
      />
    </RequirePermission>
  );
}
