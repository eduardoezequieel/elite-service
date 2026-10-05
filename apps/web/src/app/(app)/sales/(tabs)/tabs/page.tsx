import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { TabsScreen } from '@/features/tabs/components/tabs-screen';
import { tabsListFrom } from '@/features/tabs/tab-format';

export const metadata: Metadata = {
  title: 'Cuentas abiertas · Elite Service',
  description: 'Lo que alguien se llevó y paga después.',
};

export default async function OpenTabsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { highlight, ...initial } = tabsListFrom(await searchParams);

  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.read.key}
      fallback={<PermissionDenied screen="las cuentas abiertas" />}
    >
      <TabsScreen initial={initial} highlight={highlight} />
    </RequirePermission>
  );
}
