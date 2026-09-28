import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { ConsumptionReportScreen } from '@/features/inventory/components/consumption-report-screen';
import { consumptionRangeFrom } from '@/features/inventory/consumption';

export const metadata: Metadata = {
  title: 'Consumos del personal · Elite Service',
  description: 'Lo que cada trabajador tomó del inventario en unas fechas, a precio de venta.',
};

export default async function InventoryConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.inventory.actions.read.key}
      fallback={<PermissionDenied screen="los consumos del personal" />}
    >
      <ConsumptionReportScreen initialRange={consumptionRangeFrom(params)} />
    </RequirePermission>
  );
}
