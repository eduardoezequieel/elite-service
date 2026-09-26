import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { InventoryScreen } from '@/features/inventory/components/inventory-screen';
import { inventoryListFrom } from '@/features/inventory/list-params';

export const metadata: Metadata = {
  title: 'Inventario · Elite Service',
  description: 'Productos que se venden en el lavado e insumos que se despachan al equipo.',
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.inventory.actions.read.key}
      fallback={<PermissionDenied screen="el inventario" />}
    >
      <InventoryScreen initial={inventoryListFrom(params)} />
    </RequirePermission>
  );
}
