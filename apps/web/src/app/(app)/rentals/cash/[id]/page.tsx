import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { RentalCashSessionScreen } from '@/features/rental-billing/components/rental-cash-screen';

export const metadata: Metadata = { title: 'Turno de caja · Elite Service' };

export default async function RentalCashSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequirePermission permission={PERMISSIONS.rentals.actions.charge.key}>
      <RentalCashSessionScreen id={id} />
    </RequirePermission>
  );
}
