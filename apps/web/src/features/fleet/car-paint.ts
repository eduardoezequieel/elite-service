/**
 * spec 115, RN-3 — El color del dibujo de un carro.
 *
 * `color` es texto libre («Rojo», «gris oscuro», «Plateado»): se normaliza
 * (minúsculas, sin tildes) y la primera palabra que coincide con la paleta
 * decide. Lo que no coincide sale gris. Los valores viven en `globals.css`
 * como `--car-paint-*`; acá solo se elige el token.
 */
export const CAR_PAINTS = [
  'white',
  'black',
  'gray',
  'silver',
  'red',
  'blue',
  'wine',
  'green',
  'yellow',
  'orange',
  'brown',
  'beige',
  'gold',
] as const;
export type CarPaint = (typeof CAR_PAINTS)[number];

const WORDS: Record<string, CarPaint> = {
  blanco: 'white',
  blanca: 'white',
  perla: 'white',
  negro: 'black',
  negra: 'black',
  gris: 'gray',
  grafito: 'gray',
  plata: 'silver',
  plateado: 'silver',
  plateada: 'silver',
  rojo: 'red',
  roja: 'red',
  azul: 'blue',
  celeste: 'blue',
  vino: 'wine',
  corinto: 'wine',
  guinda: 'wine',
  verde: 'green',
  amarillo: 'yellow',
  amarilla: 'yellow',
  naranja: 'orange',
  anaranjado: 'orange',
  cafe: 'brown',
  marron: 'brown',
  beige: 'beige',
  champagne: 'beige',
  arena: 'beige',
  dorado: 'gold',
  dorada: 'gold',
};

export function carPaint(color: string | null): CarPaint {
  if (color === null) return 'gray';

  const words = color
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/);

  for (const word of words) {
    const paint = WORDS[word];
    if (paint !== undefined) return paint;
  }

  return 'gray';
}

export function carPaintToken(paint: CarPaint): string {
  return `--car-paint-${paint}`;
}
