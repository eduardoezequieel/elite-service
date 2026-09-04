import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { CashSessionDetailScreen } from '@/features/carwash/components/cash-session-detail-screen';

export const metadata: Metadata = { title: 'Turno de caja · Elite Service' };

export default async function CarwashCashSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequirePermission permission={PERMISSIONS.carwash.actions.cash.key}>
      <CashSessionDetailScreen id={id} />
    </RequirePermission>
  );
}
