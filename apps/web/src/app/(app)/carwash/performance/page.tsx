import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PERMISSIONS } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { PerformanceScreen } from '@/features/carwash/components/performance/performance-screen';

export const metadata: Metadata = {
  title: 'Rendimiento · Elite Service',
  description: 'Comisiones, tiempos, extras y clientes fieles del lavado.',
};

/**
 * Rendimiento (spec 067). Pestaña, empleado y rango los lee la pantalla de la
 * URL (`useSearchParams`), así que va dentro de un `Suspense`.
 */
export default function CarwashPerformancePage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.commissions.key}
      fallback={
        <>
          <ScreenHeader title="Rendimiento" />
          <p className="text-text-dim text-body">No tenés permiso para ver el rendimiento.</p>
        </>
      }
    >
      <Suspense fallback={null}>
        <PerformanceScreen />
      </Suspense>
    </RequirePermission>
  );
}
