import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CatalogScreen } from '@/features/catalog/components/catalog-screen';

export const metadata: Metadata = {
  title: 'Catálogo · Elite Service',
  description: 'Servicios de lavado y sus precios por tipo de carro.',
};

export default function CatalogPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.services.actions.read.key}
      fallback={<PermissionDenied screen="el catálogo" />}
    >
      <CatalogScreen />
    </RequirePermission>
  );
}
