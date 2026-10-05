import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { NewSaleScreen } from '@/features/sales/components/new-sale-screen';

export const metadata: Metadata = { title: 'Nueva venta · Elite Service' };

export default function NewSalePage() {
  return (
    <RequirePermission
      permission={[PERMISSIONS.carwash.actions.read.key, PERMISSIONS.carwash.actions.charge.key]}
      fallback={<PermissionDenied screen="la venta suelta" />}
    >
      {/* A quién se le anota viene en la URL (`useSearchParams`, 105). */}
      <Suspense fallback={null}>
        <NewSaleScreen />
      </Suspense>
    </RequirePermission>
  );
}
