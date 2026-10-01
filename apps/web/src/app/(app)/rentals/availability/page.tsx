import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AvailabilityScreen } from '@/features/rentals/components/availability-screen';

export const metadata: Metadata = {
  title: '¿Qué hay libre? · Elite Service',
  description: 'Qué carros están libres en un rango, con tarifa y total estimado.',
};

export default function AvailabilityPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="la disponibilidad de la flota" />}
    >
      <AvailabilityScreen />
    </RequirePermission>
  );
}
