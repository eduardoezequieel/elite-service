import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { TabDetailScreen } from '@/features/tabs/components/tab-detail-screen';

export const metadata: Metadata = { title: 'Cuenta · Elite Service' };

export default async function TabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.read.key}
      fallback={<PermissionDenied screen="la cuenta" />}
    >
      <TabDetailScreen id={id} />
    </RequirePermission>
  );
}
