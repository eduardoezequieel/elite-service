import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RentalCashScreen } from '@/features/rental-billing/components/rental-cash-screen';

export const metadata: Metadata = {
  title: 'Caja de renta · Elite Service',
  description: 'Cobros del día por forma de pago y por usuario, depósitos y cuentas por cobrar.',
};

export default function RentalCashPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.charge.key}
      fallback={<PermissionDenied screen="la caja de renta" />}
    >
      <RentalCashScreen />
    </RequirePermission>
  );
}
