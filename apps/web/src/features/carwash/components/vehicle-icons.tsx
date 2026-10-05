/**
 * Los perfiles de vehículo del lavado: los tres carros del prototipo y la moto
 * (105).
 *
 * Son siluetas de perfil con el mismo trazo (1.6px) y el mismo lienzo, para que
 * las tarjetas del selector se lean como una familia y no como dibujos
 * sueltos. El color sale de `currentColor`: acá no hay ni un color.
 */

import { bodyTypeShapeOf, type BodyTypeShape } from '../body-type-shape';

export { BODY_TYPE_MODELS, bodyTypeShapeOf, type BodyTypeShape } from '../body-type-shape';

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
  moto: [
    // Colín, asiento y tanque hasta la pipa de dirección.
    'M5 11l3-1.5h14c1.5-2 3.5-3 6-3l4 .6',
    // Basculante, motor y bajante del cuadro hasta la pipa.
    'M10 16l8-2h8l6.5-6',
    // Cuadro trasero: del eje del basculante al asiento.
    'M18 14l-2-4.5',
    // Horquilla del eje delantero al manubrio, y el puño.
    'M38 16 30 4M27 4h4.5',
    // Escape.
    'M16 17.5h7',
  ],
};

type Wheel = { cx: number; cy: number; r: number };

const CAR_WHEELS: readonly Wheel[] = [
  { cx: 13, cy: 17, r: 3 },
  { cx: 35, cy: 17, r: 3 },
];

/**
 * Las ruedas de cada silueta. Los carros comparten las de siempre; la moto
 * lleva dos más grandes y más separadas, sobre el mismo suelo (y = 20).
 */
const WHEELS: Record<BodyTypeShape, readonly Wheel[]> = {
  sedan: CAR_WHEELS,
  suv: CAR_WHEELS,
  pickup: CAR_WHEELS,
  moto: [
    { cx: 10, cy: 16, r: 4 },
    { cx: 38, cy: 16, r: 4 },
  ],
};

/** Icono de perfil parejo según el tipo de vehículo (sedán, camioneta, pick up, moto). */
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
      {WHEELS[shape].map((wheel) => (
        <circle key={wheel.cx} cx={wheel.cx} cy={wheel.cy} r={wheel.r} />
      ))}
    </svg>
  );
}
