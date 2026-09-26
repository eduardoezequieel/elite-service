import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { SaleDetailScreen } from '@/features/sales/components/sale-detail-screen';

export const metadata: Metadata = { title: 'Venta · Elite Service' };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.read.key}
      fallback={<PermissionDenied screen="la venta" />}
    >
      <SaleDetailScreen id={id} />
    </RequirePermission>
  );
}
