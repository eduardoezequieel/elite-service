import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { TicketDetailScreen } from '@/features/carwash/components/ticket-detail-screen';

export const metadata: Metadata = { title: 'Lavado · Elite Service' };

export default async function CarwashTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequirePermission permission={PERMISSIONS.carwash.actions.read.key}>
      <TicketDetailScreen id={id} />
    </RequirePermission>
  );
}
