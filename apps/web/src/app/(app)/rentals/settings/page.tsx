import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RentalSettingsScreen } from '@/features/rental-settings/components/rental-settings-screen';

export const metadata: Metadata = {
  title: 'Ajustes de renta · Elite Service',
  description: 'Datos de la empresa, del contrato, cláusulas, accesorios y logo.',
};

export default function RentalSettingsPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.settings.key}
      fallback={<PermissionDenied screen="los ajustes de la renta" />}
    >
      <RentalSettingsScreen />
    </RequirePermission>
  );
}
