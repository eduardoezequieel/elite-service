import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { RentersScreen } from '@/features/renters/components/renters-screen';

export const metadata: Metadata = {
  title: 'Clientes de renta · Elite Service',
  description: 'Quién renta los carros, con los datos que pide el contrato.',
};

export default function RentersPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.renters.actions.read.key}
      fallback={<PermissionDenied screen="los clientes de renta" />}
    >
      <RentersScreen />
    </RequirePermission>
  );
}
