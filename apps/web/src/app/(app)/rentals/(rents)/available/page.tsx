import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AvailableScreen } from '@/features/rentals/components/available-screen';

export const metadata: Metadata = {
  title: 'Libre · Elite Service',
  description: 'Carros libres entre dos fechas.',
};

export default function AvailablePage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="lo libre" />}
    >
      <AvailableScreen />
    </RequirePermission>
  );
}
