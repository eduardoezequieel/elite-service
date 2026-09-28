/**
 * Cuándo algo que ya estaba montado merece moverse (spec 088).
 *
 * Entrar lo resuelve CSS solo: una animación corre cuando el elemento se
 * inserta, y React no reinserta lo que conserva su `key`. Lo que CSS no sabe es
 * si una fila nueva *llegó* —un lavado que entró por el hilo en vivo— o si es
 * parte de una lista entera que cambió —otra página, otro filtro—. Eso, y si un
 * valor cambió después de montarse, se decide acá.
 */

/** Más filas nuevas que esto de una vez es otra lista, no una llegada. */
export const MAX_ARRIVALS = 2;

const NO_KEYS: ReadonlySet<string> = new Set();

/**
 * Las filas que llegaron entre `previous` y `next`.
 *
 * Una llegada es una o dos filas nuevas en una lista que sigue mostrando al
 * menos una de antes. Sin lista previa (el primer render), sin ninguna fila en
 * común (otra página) o con muchas nuevas (otro filtro) no llegó nada.
 */
export function arrivedKeys(
  previous: readonly string[],
  next: readonly string[],
): ReadonlySet<string> {
  const before = new Set(previous);
  const added = next.filter((key) => !before.has(key));
  const kept = next.length - added.length;

  if (kept === 0 || added.length === 0 || added.length > MAX_ARRIVALS) return NO_KEYS;

  return new Set(added);
}

/** Cuántas veces cambió un valor desde que se montó, sin contar el montaje. */
export interface ChangeCount<T> {
  value: T;
  count: number;
}

/**
 * El contador tras ver `value`. `isChange` decide qué cuenta: por defecto,
 * cualquier diferencia; la campana cuenta solo cuando sube.
 */
export function countChange<T>(
  state: ChangeCount<T>,
  value: T,
  isChange: (previous: T, next: T) => boolean = (previous, next) => !Object.is(previous, next),
): ChangeCount<T> {
  if (Object.is(state.value, value)) return state;

  return { value, count: isChange(state.value, value) ? state.count + 1 : state.count };
}

/** Solo cuando sube: se leyó un aviso y el globo baja sin moverse. */
export function rose(previous: number, next: number): boolean {
  return next > previous;
}

/**
 * El atributo que dispara la marca de cambio. Alterna entre dos valores para
 * que dos cambios seguidos reinicien la animación: con el mismo valor, el
 * navegador no la vuelve a correr. Sin cambios, no hay atributo.
 */
export function changeMark(count: number): 'odd' | 'even' | undefined {
  if (count === 0) return undefined;

  return count % 2 === 1 ? 'odd' : 'even';
}
