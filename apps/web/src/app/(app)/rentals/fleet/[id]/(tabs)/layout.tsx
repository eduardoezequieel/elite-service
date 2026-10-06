import type { ReactNode } from 'react';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { FleetVehicleFrame } from '@/features/fleet/components/fleet-vehicle-frame';

/**
 * Layout de las pestañas de la ficha de un carro: Ficha, Servicio, Gastos
 * y ¿Cuánto dejó? (095, patrón 092). El marco vive acá para que cambiar de pestaña
 * cambie solo el hijo. Cada página sigue pidiendo su permiso.
 */
export default async function FleetVehicleTabsLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;

  return (
    <RequirePermission
      permission={PERMISSIONS.fleet.actions.read.key}
      fallback={<PermissionDenied screen="la flota" />}
    >
      <FleetVehicleFrame id={id}>{children}</FleetVehicleFrame>
    </RequirePermission>
  );
}
