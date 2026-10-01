import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PrintScreen } from '@/features/rental-documents/components/print-screen';

export const metadata: Metadata = { title: 'Contrato · Elite Service' };

export default async function AgreementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.rentals.actions.read.key}
      fallback={
        <main className="bg-bg min-h-screen p-plate">
          <PermissionDenied screen="el contrato" />
        </main>
      }
    >
      <PrintScreen id={id} />
    </RequirePermission>
  );
}
