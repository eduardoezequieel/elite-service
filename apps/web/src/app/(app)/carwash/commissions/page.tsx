import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CommissionsScreen } from '@/features/carwash/components/commissions-screen';

export const metadata: Metadata = {
  title: 'Comisiones · Elite Service',
  description: 'Lo que hay que pagarle a cada lavador.',
};

export default function CarwashCommissionsPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.commissions.key}
      fallback={
        <>
          <ScreenHeader title="Comisiones" />
          <p className="text-text-dim text-body">No tenés permiso para ver las comisiones.</p>
        </>
      }
    >
      <CommissionsScreen />
    </RequirePermission>
  );
}
