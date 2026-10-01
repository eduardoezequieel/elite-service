/**
 * La flota de la rentadora (095): reglas puras, sin Nest ni Prisma.
 *
 * Que la placa llegue en mayúsculas y sin espacios lo hace el schema de
 * `@elite/shared` (RN-2); acá queda la regla de unicidad, que el repositorio
 * hace cumplir con el índice único de `fleet_vehicles.plate`.
 */

/** Ya hay otro carro de la flota con esa placa (RN-2). */
export class FleetPlateTakenError extends Error {
  constructor(readonly plate: string) {
    super(`A fleet vehicle with plate ${plate} already exists`);
    this.name = 'FleetPlateTakenError';
  }
}

/**
 * Un carro sin placa no choca con nadie: la placa es única **cuando existe**
 * (RN-2). Dos carros sin placa conviven.
 */
export function plateCollides(plate: string | null | undefined): plate is string {
  return plate !== null && plate !== undefined && plate !== '';
}
