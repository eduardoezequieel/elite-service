import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { BankAccountsScreen } from '@/features/banking/components/bank-accounts-screen';

export const metadata: Metadata = {
  title: 'Cuentas bancarias · Elite Service',
  description: 'Las cuentas del negocio a las que entra una transferencia.',
};

export default function BankAccountsPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.banking.actions.manage.key}
      fallback={<PermissionDenied screen="las cuentas bancarias" />}
    >
      <BankAccountsScreen />
    </RequirePermission>
  );
}
