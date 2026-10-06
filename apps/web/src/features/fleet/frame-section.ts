export type FleetVehicleSection = 'details' | 'maintenance' | 'expenses' | 'months';

/** Las cuatro pestañas de la ficha de un carro (095); solo la primera existe hoy. */
export const FLEET_VEHICLE_SECTIONS: readonly {
  value: FleetVehicleSection;
  label: string;
  /** Lo que se agrega a `/rentals/fleet/<id>`. */
  suffix: string;
}[] = [
  { value: 'details', label: 'Ficha', suffix: '' },
  { value: 'maintenance', label: 'Servicio', suffix: '/maintenance' },
  { value: 'expenses', label: 'Gastos', suffix: '/expenses' },
  { value: 'months', label: '¿Cuánto dejó?', suffix: '/months' },
];

/** La pestaña activa sale de la ruta (patrón 092); lo que no es otra, es la Ficha. */
export function fleetVehicleSectionFor(pathname: string): FleetVehicleSection {
  const last = pathname.split('/').pop() ?? '';
  const match = FLEET_VEHICLE_SECTIONS.find((section) => section.suffix === `/${last}`);

  return match?.value ?? 'details';
}
