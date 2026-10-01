import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AgreementDetailScreen } from '@/features/rentals/components/agreement-detail-screen';

export const metadata: Metadata = { title: 'Renta · Elite Service' };

export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="la renta" />}
    >
      <AgreementDetailScreen id={id} />
    </RequirePermission>
  );
}
