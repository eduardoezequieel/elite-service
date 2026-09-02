import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { TicketsScreen } from '@/features/carwash/components/tickets-screen';

export const metadata: Metadata = {
  title: 'Lavados · Elite Service',
  description: 'La fila de lavados del día.',
};

export default function CarwashPage() {
  return (
    <RequirePermission permission={PERMISSIONS.carwash.actions.read.key}>
      <TicketsScreen />
    </RequirePermission>
  );
}
