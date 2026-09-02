/**
 * Una bandera booleana que llega por query string.
 *
 * En una URL todo es texto: `?activeOnly=false` llega como `'false'`, que en
 * JavaScript es cierto. Esto lo resuelve en un solo sitio para que ningun
 * controller lo interprete a su manera.
 *
 * Solo el texto exacto `'false'` (o `'0'`) apaga la bandera; ausente o
 * cualquier otra cosa deja el valor por omision. Un parametro mal escrito no
 * cambia el comportamiento en silencio.
 */
export function flagFromQuery(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();

  if (normalized === 'false' || normalized === '0') return false;
  if (normalized === 'true' || normalized === '1') return true;

  return fallback;
}
