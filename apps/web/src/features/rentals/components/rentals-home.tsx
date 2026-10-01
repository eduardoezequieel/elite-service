import { KeyRound } from 'lucide-react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Inicio del espacio «Renta de carros» (094).
 *
 * Por ahora solo abre la puerta: la flota, los clientes y las rentas llegan con
 * las specs 095 en adelante. Sin botón, porque todavía no hay nada que cargar.
 */
export function RentalsHome() {
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Renta de carros" subtitle="Flota, rentas y contratos" />

      <EmptyState
        icon={KeyRound}
        title="Todavía no hay flota"
        description="Los carros se cargan en la siguiente etapa."
      />
    </div>
  );
}
