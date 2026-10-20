import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { TodayScreen } from '@/features/rental-reports/components/today-screen';

export const metadata: Metadata = {
  title: 'Hoy · Elite Service',
  description: 'Flota, semana, dinero y pendientes del día.',
};

export default function RentalsPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="la renta" />}
    >
      <TodayScreen />
    </RequirePermission>
  );
}
