import type { FleetVehicle, VehicleAvailability } from '@elite/shared';

import type { BackLinkTarget } from '@/components/app-shell/back-link';

/** El regreso de la ficha de un carro y de ¿Cuánto dejó? (121). */
export const FLEET_BACK: BackLinkTarget = { href: '/rentals/fleet', label: 'Carros' };

/** Lo urgente primero (115). El orden de los chips y de la grilla (121). */
export const AVAILABILITY_ORDER: readonly VehicleAvailability[] = [
  'OVERDUE',
  'RENTED',
  'RESERVED',
  'FREE',
  'WORKSHOP',
];

type WithAvailability = Pick<FleetVehicle, 'availability'>;

function rank(availability: VehicleAvailability | null): number {
  return availability === null
    ? AVAILABILITY_ORDER.length
    : AVAILABILITY_ORDER.indexOf(availability);
}

/** Los carros en una sola grilla (121): por `AVAILABILITY_ORDER`, estable dentro de cada estado. */
export function sortByAvailability<T extends WithAvailability>(vehicles: readonly T[]): T[] {
  return [...vehicles].sort((a, b) => rank(a.availability) - rank(b.availability));
}

/** Los chips de estado (121): solo los que tienen carros, en orden, con su cantidad. */
export function availabilityCounts(
  vehicles: readonly WithAvailability[],
): { availability: VehicleAvailability; count: number }[] {
  return AVAILABILITY_ORDER.map((availability) => ({
    availability,
    count: vehicles.filter((vehicle) => vehicle.availability === availability).length,
  })).filter((entry) => entry.count > 0);
}

/** «Mandar al taller» (121): los carros con al menos un aviso de servicio. */
export function workshopCount(vehicles: readonly Pick<FleetVehicle, 'alerts'>[]): number {
  return vehicles.filter((vehicle) => vehicle.alerts.some((alert) => alert.kind === 'SERVICE'))
    .length;
}
