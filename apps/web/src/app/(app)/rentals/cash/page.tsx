import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RentalCashScreen } from '@/features/rental-billing/components/rental-cash-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Caja de renta · Elite Service',
  description: 'Cobros del día por forma de pago y por usuario, depósitos y cuentas por cobrar.',
};

export default async function RentalCashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.charge.key}
      fallback={<PermissionDenied screen="la caja de renta" />}
    >
      <RentalCashScreen
        initialPaymentsPage={pageParam(params.paymentsPage)}
        initialDepositsPage={pageParam(params.depositsPage)}
        initialReceivablesPage={pageParam(params.receivablesPage)}
      />
    </RequirePermission>
  );
}
