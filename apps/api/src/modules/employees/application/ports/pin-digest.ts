/**
 * Puerto del digest del PIN (044 RN-4).
 *
 * Reemplaza al hasher bcrypt de la 003 y la diferencia no es de algoritmo sino
 * de forma: **es determinista**. A la pista se entra solo con el PIN, asi que
 * hay que encontrar al empleado POR el PIN; con bcrypt —un hash distinto cada
 * vez, por la sal— eso obliga a probar contra cada empleado en cada intento.
 *
 * Que sea determinista tambien es lo que deja que la unicidad del PIN la
 * garantice un indice de la base y no una carrera entre dos altas (RN-3).
 *
 * La fuerza ya no viene del costo del algoritmo sino del secreto: sin el pepper
 * un volcado de la base no dice ningun PIN. Contra el intento a ciegas responde
 * el freno de RN-6, no esto.
 */
export interface PinDigest {
  /** Del PIN en claro al valor que se guarda y se busca. Nunca al reves. */
  digest(pin: string): string;
}

export const PIN_DIGEST = Symbol('employees.PinDigest');
