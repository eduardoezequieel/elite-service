import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { CustomerDetailScreen } from '@/features/customers/components/customer-detail-screen';

export const metadata: Metadata = { title: 'Cliente · Elite Service' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission permission={PERMISSIONS.customers.actions.read.key}>
      <CustomerDetailScreen id={id} />
    </RequirePermission>
  );
}
