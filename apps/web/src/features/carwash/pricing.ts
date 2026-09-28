/**
 * Dinero del alta: centavos, máscara del campo y el precio de un servicio (030, 087).
 *
 * Vive suelto y sin React a propósito: es la única lógica del alta que se puede
 * probar sin montar la pantalla, y el precio de un servicio es una regla de
 * negocio que no puede depender de cómo se dibuje el campo.
 *
 * Un servicio de lavado se cobra por debajo o por encima del catálogo: el único
 * piso es cero y no hay techo (087). El API vuelve a validar lo mismo.
 */

import { centsToAmount, parseCents } from '@/lib/money';

/**
 * Lo que se deja teclear en el campo de precio.
 *
 * Solo dígitos y un separador decimal, con dos decimales como mucho. La coma se
 * acepta y se guarda como punto: el teclado numérico de la tablet da coma y el
 * API espera punto.
 */
export function maskMoneyInput(raw: string): string {
  const clean = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = clean.split('.');
  const head = whole.slice(0, 6);

  if (rest.length === 0) return head;

  return `${head}.${rest.join('').slice(0, 2)}`;
}

/**
 * El precio de un servicio que de verdad se va a cobrar (087).
 *
 * Sube o baja libre, con piso en cero. Un campo vacío o ilegible vuelve al
 * catálogo, que es lo que el usuario esperaba antes de tocarlo.
 */
export function normalizeServicePrice(raw: string, catalogPrice: string): string {
  const trimmed = raw.trim();

  if (trimmed === '' || Number.isNaN(Number.parseFloat(trimmed.replace(',', '.')))) {
    return centsToAmount(parseCents(catalogPrice));
  }

  return centsToAmount(Math.max(parseCents(trimmed), 0));
}

/**
 * El precio de un servicio cuando cambia el tipo de carro (030 RN-3, 087).
 *
 * El que estaba en catálogo sigue al catálogo nuevo. El rebajado conserva su
 * precio pero no pasa el catálogo nuevo; el que tenía recargo, el espejo: no
 * baja del catálogo nuevo. Así el cambio de tipo nunca vuelve un descuento en
 * recargo ni al revés.
 */
export function rebaseServicePrice(
  price: string,
  previousCatalog: string,
  nextCatalog: string,
): string {
  const cents = parseCents(price);
  const previous = parseCents(previousCatalog);
  const next = parseCents(nextCatalog);

  if (cents === previous) return centsToAmount(next);

  return centsToAmount(cents < previous ? Math.min(cents, next) : Math.max(cents, next));
}

/** Cuánto se bajó respecto del catálogo, en centavos. Cero si no hubo descuento. */
export function discountCents(catalogPrice: string, unitPrice: string): number {
  return Math.max(0, parseCents(catalogPrice) - parseCents(unitPrice));
}

/** Cuánto se subió respecto del catálogo, en centavos. Cero si no hubo recargo (087). */
export function surchargeCents(catalogPrice: string, unitPrice: string): number {
  return Math.max(0, parseCents(unitPrice) - parseCents(catalogPrice));
}
