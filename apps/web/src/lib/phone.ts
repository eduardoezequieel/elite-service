/**
 * Normaliza y formatea un número de teléfono con la máscara de El Salvador (####-####).
 *
 * - Acepta solo caracteres numéricos.
 * - Si se ingresa o pega con código de país (+503 o 503 con más de 8 dígitos), extrae los 8 dígitos locales.
 * - Trunca a un máximo de 8 dígitos.
 * - Agrega el guion automáticamente tras el cuarto dígito.
 */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('503') && digits.length > 8) {
    digits = digits.slice(3);
  }

  digits = digits.slice(0, 8);

  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/**
 * Retorna solo los dígitos de un teléfono.
 */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}
