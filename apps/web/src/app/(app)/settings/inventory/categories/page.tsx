import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CATEGORY_KIND_PARAM, categoryKindFromParam } from '@/features/inventory/category-kind';
import { InventoryCategoriesScreen } from '@/features/inventory/components/categories-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Categorías de inventario · Elite Service',
  description: 'Categorías propias del inventario: de productos o de insumos.',
};

export default async function InventoryCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.inventory.actions.read.key}
      fallback={<PermissionDenied screen="las categorías del inventario" />}
    >
      <InventoryCategoriesScreen
        kind={categoryKindFromParam(params[CATEGORY_KIND_PARAM])}
        initialPage={pageParam(params.page)}
      />
    </RequirePermission>
  );
}
