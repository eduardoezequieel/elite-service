import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RentersScreen } from '@/features/renters/components/renters-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Clientes de renta · Elite Service',
  description: 'Quién renta los carros, con los datos que pide el contrato.',
};

export default async function RentersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.renters.actions.read.key}
      fallback={<PermissionDenied screen="los clientes de renta" />}
    >
      <RentersScreen initialPage={pageParam(params.page)} />
    </RequirePermission>
  );
}
