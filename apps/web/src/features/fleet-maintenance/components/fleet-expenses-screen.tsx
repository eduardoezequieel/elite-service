'use client';

import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { presetRange } from '@/lib/civil-date';
import { FleetExpensesPanel } from './fleet-expenses-panel';

/**
 * `/rentals/expenses` (099): los gastos de toda la flota, de este mes por
 * defecto. Los lavados pagados del carwash y las multas no cargadas al cliente
 * aparecen solos.
 */
export function FleetExpensesScreen() {
  const [initialRange] = useState(() => presetRange('month'));

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Gastos" subtitle="Lo que cuesta cada carro de la flota" />
      <FleetExpensesPanel initialRange={initialRange} />
    </div>
  );
}

/**
 * La pestaña Gastos de la ficha de un carro (099): los gastos de ese carro, de
 * lo que va del año por defecto, con su total.
 */
export function VehicleExpensesTab({ id }: { id: string }) {
  const [initialRange] = useState(() => {
    const month = presetRange('month');

    return { from: `${month.to.slice(0, 4)}-01-01`, to: month.to };
  });

  return <FleetExpensesPanel vehicleId={id} initialRange={initialRange} />;
}
