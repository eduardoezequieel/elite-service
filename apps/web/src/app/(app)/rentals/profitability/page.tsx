import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ProfitabilityScreen } from '@/features/rental-reports/components/profitability-screen';

export const metadata: Metadata = { title: 'Rentabilidad · Elite Service' };

export default function RentalProfitabilityPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.reports.key}
      fallback={<PermissionDenied screen="la rentabilidad" />}
    >
      <ProfitabilityScreen />
    </RequirePermission>
  );
}
