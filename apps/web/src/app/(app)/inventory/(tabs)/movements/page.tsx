import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { MovementsScreen } from '@/features/inventory/components/movements-screen';
import { movementsFilterFrom } from '@/features/inventory/list-params';

export const metadata: Metadata = {
  title: 'Movimientos · Elite Service',
  description: 'Quién despachó qué, a quién, y qué entró al inventario.',
};

export default async function InventoryMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.inventory.actions.read.key}
      fallback={<PermissionDenied screen="los movimientos del inventario" />}
    >
      <MovementsScreen initial={movementsFilterFrom(params)} />
    </RequirePermission>
  );
}
