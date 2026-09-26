import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { InventoryCategoriesScreen } from '@/features/inventory/components/categories-screen';

export const metadata: Metadata = {
  title: 'Categorías de inventario · Elite Service',
  description: 'Categorías propias del inventario.',
};

export default function InventoryCategoriesPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.inventory.actions.read.key}
      fallback={<PermissionDenied screen="las categorías del inventario" />}
    >
      <InventoryCategoriesScreen />
    </RequirePermission>
  );
}
