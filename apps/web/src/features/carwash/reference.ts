/**
 * El número de referencia de un lavado.
 *
 * El sistema guarda el folio completo (`CW-0014`) pero en pantalla el lavado se
 * llama `#14` (RN-15): es lo que se grita en la bahía. Esto convierte uno en el
 * otro; si el folio viniera con otra forma, devuelve 0 antes que romper.
 */
export function referenceOf(number: string): number {
  const sequence = Number(number.slice(number.indexOf('-') + 1));

  return Number.isFinite(sequence) ? sequence : 0;
}
