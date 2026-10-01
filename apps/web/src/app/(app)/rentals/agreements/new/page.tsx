import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { AgreementFormScreen } from '@/features/rentals/components/agreement-form-screen';
import { singleParam, type SearchValue } from '@/lib/list-params';

export const metadata: Metadata = { title: 'Nueva renta · Elite Service' };

/** `?vehicleId&from&to&customerId` llegan del calendario, de «¿Qué hay libre?» y de la ficha del cliente. */
export default async function NewAgreementPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.manage.key}
      fallback={<PermissionDenied screen="la nueva renta" />}
    >
      <AgreementFormScreen
        prefill={{
          vehicleId: singleParam(params.vehicleId),
          from: singleParam(params.from),
          to: singleParam(params.to),
          customerId: singleParam(params.customerId),
        }}
      />
    </RequirePermission>
  );
}
