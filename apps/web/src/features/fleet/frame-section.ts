export type FleetVehicleSection = 'details' | 'maintenance' | 'months';

/** Las pestañas de la ficha de un carro (095). Servicio y Gastos son una sola desde la 122. */
export const FLEET_VEHICLE_SECTIONS: readonly {
  value: FleetVehicleSection;
  label: string;
  /** Lo que se agrega a `/rentals/fleet/<id>`. */
  suffix: string;
}[] = [
  { value: 'details', label: 'Ficha', suffix: '' },
  { value: 'maintenance', label: 'Servicio y gastos', suffix: '/maintenance' },
  { value: 'months', label: '¿Cuánto dejó?', suffix: '/months' },
];

/** La pestaña activa sale de la ruta (patrón 092); lo que no es otra, es la Ficha. */
export function fleetVehicleSectionFor(pathname: string): FleetVehicleSection {
  const last = pathname.split('/').pop() ?? '';
  const match = FLEET_VEHICLE_SECTIONS.find((section) => section.suffix === `/${last}`);

  return match?.value ?? 'details';
}
