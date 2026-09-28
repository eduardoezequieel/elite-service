import type { Metadata } from 'next';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CATALOG_PERMISSIONS, CATALOG_TAB_PARAM } from '@/features/catalog/catalog-tabs';
import { CatalogScreen } from '@/features/catalog/components/catalog-screen';

export const metadata: Metadata = {
  title: 'Catálogo · Elite Service',
  description: 'Servicios de lavado con sus precios, y los productos e insumos del inventario.',
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={[...CATALOG_PERMISSIONS]}
      mode="any"
      fallback={<PermissionDenied screen="el catálogo" />}
    >
      <CatalogScreen initialTab={params[CATALOG_TAB_PARAM]} />
    </RequirePermission>
  );
}
