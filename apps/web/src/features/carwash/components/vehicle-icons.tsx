/**
 * Los tres perfiles de vehículo del prototipo.
 *
 * Son siluetas de perfil con el mismo trazo (1.6px) y el mismo lienzo, para que
 * las tres tarjetas del selector se lean como una familia y no como tres
 * dibujos sueltos. El color sale de `currentColor`: acá no hay ni un color.
 */

/** Las tres formas que sabe dibujar el sistema. */
export type BodyTypeShape = 'sedan' | 'suv' | 'pickup';

/**
 * A qué silueta se parece un tipo de carro del catálogo.
 *
 * El catálogo lo administra el taller, así que el `key` y el nombre pueden ser
 * cualquier cosa: se busca por palabra y, si no se reconoce, se cae en sedán.
 */
export function bodyTypeShapeOf(key: string, name?: string): BodyTypeShape {
  const normalized = `${key} ${name ?? ''}`.toLowerCase();

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
 * llama la carrocería de su carro. Por eso viven en la interfaz y no en el API.
 */
export const BODY_TYPE_MODELS: Record<BodyTypeShape, string> = {
  sedan: 'Corolla, Civic, Sentra',
  suv: 'RAV4, CR-V, Fortuner',
  pickup: 'Hilux, Ranger, D-Max',
};

const PATHS: Record<BodyTypeShape, readonly string[]> = {
  sedan: [
    'M4 17v-4a2 2 0 0 1 1.7-2l6.3-.9 3.6-3.5A4 4 0 0 1 18.4 5.5h9.9a4 4 0 0 1 2.8 1.2l3.5 3.5 6.7 1a2 2 0 0 1 1.7 2V17',
    'M4 17h6M16 17h16M38 17h6',
  ],
  suv: [
    'M4 17v-4.6a2 2 0 0 1 1.7-2l1.3-.2V6.4A1.9 1.9 0 0 1 8.9 4.5h18.3c.7 0 1.3.3 1.7.9l3 4.2 6.7 1a2 2 0 0 1 1.7 2V17',
    'M4 17h6M16 17h16M38 17h6',
  ],
  pickup: [
    'M4 17v-4.4a2 2 0 0 1 1.7-2l1.3-.2 3.1-4.1a2.2 2.2 0 0 1 1.8-.8h7.6c1.05 0 1.9.85 1.9 1.9v4.2h20.7c.9 0 1.6.7 1.6 1.6V17',
    'M4 17h6M16 17h16M38 17h4',
  ],
};

/** Icono de perfil parejo según el tipo de carrocería (sedán, camioneta, pick up). */
export function VehicleIcon({
  bodyTypeKey,
  bodyTypeName,
  className,
}: {
  bodyTypeKey: string;
  bodyTypeName?: string;
  className?: string;
}) {
  const shape = bodyTypeShapeOf(bodyTypeKey, bodyTypeName);

  return (
    <svg
      className={className}
      viewBox="0 0 48 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[shape].map((path) => (
        <path key={path} d={path} />
      ))}
      <circle cx="13" cy="17" r="3" />
      <circle cx="35" cy="17" r="3" />
    </svg>
  );
}
