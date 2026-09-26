import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ItemDetailScreen } from '@/features/inventory/components/item-detail-screen';

export const metadata: Metadata = { title: 'Artículo · Elite Service' };

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.inventory.actions.read.key}
      fallback={<PermissionDenied screen="el inventario" />}
    >
      <ItemDetailScreen id={id} />
    </RequirePermission>
  );
}
