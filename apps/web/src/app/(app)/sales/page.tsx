import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { SalesScreen } from '@/features/sales/components/sales-screen';

export const metadata: Metadata = {
  title: 'Ventas · Elite Service',
  description: 'Las ventas sueltas de productos del día.',
};

export default function SalesPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.read.key}
      fallback={<PermissionDenied screen="las ventas" />}
    >
      <SalesScreen />
    </RequirePermission>
  );
}
