import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CalendarScreen } from '@/features/rentals/components/calendar-screen';

export const metadata: Metadata = {
  title: 'Calendario de rentas · Elite Service',
  description: 'Quién tiene cada carro de la flota, día por día.',
};

export default function CalendarPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="el calendario de rentas" />}
    >
      <CalendarScreen />
    </RequirePermission>
  );
}
