import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CashScreen } from '@/features/carwash/components/cash-screen';

export const metadata: Metadata = {
  title: 'Caja · Elite Service',
  description: 'Turno de caja del lavado.',
};

export default function CarwashCashPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.cash.key}
      fallback={<PermissionDenied screen="la caja" />}
    >
      <CashScreen />
    </RequirePermission>
  );
}
