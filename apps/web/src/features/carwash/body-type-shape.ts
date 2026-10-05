/**
 * Las siluetas que sabe dibujar el sistema y a cuál se parece cada tipo de
 * vehículo del catálogo. Lógica pura, sin JSX: el dibujo vive en
 * `components/vehicle-icons.tsx`.
 */

/** Las cuatro formas que sabe dibujar el sistema (la moto, desde la 105). */
export type BodyTypeShape = 'sedan' | 'suv' | 'pickup' | 'moto';

/**
 * A qué silueta se parece un tipo de vehículo del catálogo.
 *
 * El catálogo lo administra el taller, así que el `key` y el nombre pueden ser
 * cualquier cosa: se busca por palabra y, si no se reconoce, se cae en sedán.
 * La moto va primero: «motocicleta» y «motorcycle» no deben caer en otra forma.
 */
export function bodyTypeShapeOf(key: string, name?: string): BodyTypeShape {
  const normalized = `${key} ${name ?? ''}`.toLowerCase();

  // «moto» ya cubre «motocicleta» y «motorcycle».
  if (normalized.includes('moto')) return 'moto';

  if (
    normalized.includes('pickup') ||
    normalized.includes('pick up') ||
    normalized.includes('truck') ||
    normalized.includes('paila')
  ) {
    return 'pickup';
  }

  if (
    normalized.includes('suv') ||
    normalized.includes('camioneta') ||
    normalized.includes('van') ||
    normalized.includes('crossover')
  ) {
    return 'suv';
  }

  return 'sedan';
}

/**
 * Modelos de ejemplo por silueta.
 *
 * No son un dato del catálogo: son la pista que necesita quien no sabe cómo se
 * llama el tipo de su vehículo. Por eso viven en la interfaz y no en el API.
 */
export const BODY_TYPE_MODELS: Record<BodyTypeShape, string> = {
  sedan: 'Corolla, Civic, Sentra',
  suv: 'RAV4, CR-V, Fortuner',
  pickup: 'Hilux, Ranger, D-Max',
  moto: 'XR150, FZ, Pulsar',
};
