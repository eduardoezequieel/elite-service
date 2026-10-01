import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RenterDetailScreen } from '@/features/renters/components/renter-detail-screen';

export const metadata: Metadata = { title: 'Cliente de renta · Elite Service' };

export default async function RenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.renters.actions.read.key}
      fallback={<PermissionDenied screen="el cliente de renta" />}
    >
      <RenterDetailScreen id={id} />
    </RequirePermission>
  );
}
