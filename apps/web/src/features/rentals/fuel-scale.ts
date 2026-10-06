/**
 * Los cuatro tramos del asistente (108) caben en `fuelEighths` sin cambiar
 * el contrato: Vacío, ¼, ½, ¾ y Lleno son 0, 2, 4, 6 y 8.
 */
export const FUEL_QUARTERS = [
  { eighths: 0, label: 'Vacío' },
  { eighths: 2, label: '¼' },
  { eighths: 4, label: '½' },
  { eighths: 6, label: '¾' },
  { eighths: 8, label: 'Lleno' },
] as const;

export type FuelQuarterEighths = (typeof FUEL_QUARTERS)[number]['eighths'];

/** El rótulo de un tramo, o `null` si el octavo no es uno de los cinco. */
export function fuelQuarterLabel(eighths: number): string | null {
  return FUEL_QUARTERS.find((level) => level.eighths === eighths)?.label ?? null;
}
