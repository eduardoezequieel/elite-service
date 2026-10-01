import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RentalsHome } from '@/features/rentals/components/rentals-home';

export const metadata: Metadata = {
  title: 'Renta de carros · Elite Service',
  description: 'Flota, rentas y contratos de la rentadora.',
};

export default function RentalsPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={<PermissionDenied screen="la renta de carros" />}
    >
      <RentalsHome />
    </RequirePermission>
  );
}
