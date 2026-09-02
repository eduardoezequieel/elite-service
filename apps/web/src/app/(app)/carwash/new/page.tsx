import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { NewTicketScreen } from '@/features/carwash/components/new-ticket-screen';

export const metadata: Metadata = { title: 'Nuevo lavado · Elite Service' };

export default function NewCarwashPage() {
  return (
    <RequirePermission permission={PERMISSIONS.carwash.actions.manage.key}>
      <NewTicketScreen />
    </RequirePermission>
  );
}
