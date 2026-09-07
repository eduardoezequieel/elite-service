/**
 * Dinero del alta: centavos, máscara del campo y el recorte del descuento (030).
 *
 * Vive suelto y sin React a propósito: es la única lógica del alta que se puede
 * probar sin montar la pantalla, y el tope del descuento es una regla de negocio
 * (022 RN-5) que no puede depender de cómo se dibuje el campo.
 *
 * El API vuelve a validar lo mismo y responde `PRICE_ABOVE_CATALOG`. Esto no lo
 * reemplaza: le evita el viaje al usuario que está con el carro enfrente.
 */

/** Centavos enteros de un precio en cadena (`'8.50'` → `850`). */
export function toCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'));

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** El precio en cadena con dos decimales, como lo espera el API (`850` → `'8.50'`). */
export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

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
 * El precio que de verdad se va a cobrar (022 RN-5).
 *
 * El descuento solo baja: el techo es el precio de catálogo para el tipo de
 * carro elegido y el piso es cero. Un campo vacío o ilegible vuelve al catálogo,
 * que es lo que el usuario esperaba antes de tocarlo.
 */
export function clampToCatalog(raw: string, catalogPrice: string): string {
  const catalog = toCents(catalogPrice);
  const trimmed = raw.trim();

  if (trimmed === '' || Number.isNaN(Number.parseFloat(trimmed.replace(',', '.')))) {
    return formatMoney(catalog);
  }

  return formatMoney(Math.min(Math.max(toCents(trimmed), 0), catalog));
}

/** Cuánto se bajó respecto del catálogo, en centavos. Cero si no hubo descuento. */
export function discountCents(catalogPrice: string, unitPrice: string): number {
  return Math.max(0, toCents(catalogPrice) - toCents(unitPrice));
}

/** El precio con un descuento en dólares aplicado, ya recortado al catálogo. */
export function discountBy(catalogPrice: string, amount: number): string {
  return clampToCatalog(formatMoney(toCents(catalogPrice) - Math.round(amount * 100)), catalogPrice);
}

/** El precio con un descuento porcentual aplicado, ya recortado al catálogo. */
export function discountByPercent(catalogPrice: string, percent: number): string {
  const catalog = toCents(catalogPrice);

  return clampToCatalog(formatMoney(catalog - Math.round((catalog * percent) / 100)), catalogPrice);
}
