import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { CustomersScreen } from '@/features/customers/components/customers-screen';

export const metadata: Metadata = {
  title: 'Clientes · Elite Service',
  description: 'Quién trae los carros al taller.',
};

export default function CustomersPage() {
  return (
    <RequirePermission permission={PERMISSIONS.customers.actions.read.key}>
      <CustomersScreen />
    </RequirePermission>
  );
}
