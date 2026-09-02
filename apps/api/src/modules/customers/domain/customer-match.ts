/**
 * Que es una coincidencia entre dos clientes (004 RN-1).
 *
 * El mostrador y la pista escriben el mismo dato de diez maneras: «Juan Perez»,
 * «JUAN PÉREZ», «juan  perez»; `7777-8888`, `7777 8888`, `77778888`. Comparar
 * letra por letra garantiza el duplicado, asi que se compara **normalizando**.
 *
 * Esto es dominio puro: no sabe de Prisma, de Nest ni de HTTP. Recibe los
 * candidatos ya cargados y decide; quien los busque es problema de otra capa.
 */

/** Lo minimo que hace falta para comparar dos clientes. */
export interface MatchCandidate {
  id: string;
  fullName: string;
  phone: string | null;
}

/** Por que coincidieron. El telefono pesa mas que el nombre. */
export type MatchReason = 'phone' | 'name';

export interface CandidateMatch<Candidate extends MatchCandidate> {
  candidate: Candidate;
  on: MatchReason;
}

/**
 * Solo los digitos. `7777-8888`, `7777 8888` y `+503 7777 8888` se reducen a
 * lo que de verdad se marca, que es lo unico que dos personas comparten cuando
 * comparten un telefono.
 */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replaceAll(/\D/gu, '');
}

/**
 * Minusculas, sin acentos y con los espacios de sobra colapsados.
 *
 * `normalize('NFD')` separa la letra de su tilde y el rango combinante se
 * borra: asi «Pérez» y «Perez» son la misma palabra sin mantener una tabla de
 * reemplazos.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/gu, ' ');
}

/**
 * El cliente que ya existe y se parece al que se esta por anotar, o `null`.
 *
 * Reglas, en este orden:
 *
 * 1. **Telefono igual = coincidencia fuerte.** Gana siempre, aunque el nombre
 *    sea otro: quien contesta ese numero es la misma persona con muchisima mas
 *    probabilidad de la que hay de que dos personas se llamen igual.
 * 2. **Nombre igual = coincidencia por nombre.** Solo se mira si el telefono no
 *    encontro a nadie.
 * 3. **Un telefono vacio nunca coincide con otro vacio.** Media agenda del
 *    taller no tiene telefono; tratar «sin telefono» como un dato compartido
 *    fusionaria a todos esos clientes en el primero de la lista.
 *
 * Si hay varios candidatos con el mismo telefono o el mismo nombre se devuelve
 * el primero: el dialogo ofrece igual «Crear otro», asi que elegir mal no
 * bloquea a nadie (RN-2).
 */
export function findCustomerMatch<Candidate extends MatchCandidate>(
  candidates: readonly Candidate[],
  query: { fullName: string; phone?: string | null },
): CandidateMatch<Candidate> | null {
  const phone = normalizePhone(query.phone);
  const name = normalizeName(query.fullName);

  if (phone !== '') {
    const byPhone = candidates.find((candidate) => normalizePhone(candidate.phone) === phone);

    if (byPhone !== undefined) return { candidate: byPhone, on: 'phone' };
  }

  if (name === '') return null;

  const byName = candidates.find((candidate) => normalizeName(candidate.fullName) === name);

  return byName === undefined ? null : { candidate: byName, on: 'name' };
}
