import type { Renter, RenterListItem } from '@elite/shared';

/**
 * Reglas puras de la lista de clientes de renta (118): qué es una búsqueda,
 * qué cuenta como renta y el orden «más reciente primero». El repositorio de
 * Prisma las repite en SQL; el de memoria las usa tal cual.
 */

/** Desde cuántos dígitos se busca también por documento y teléfono sin signos. */
export const SEARCH_MIN_DIGITS = 3;

export interface RenterSearch {
  /** El texto entero, para documento, licencia y teléfonos tal como se guardaron. */
  term: string;
  /** Las palabras: todas tienen que estar en el nombre. */
  words: string[];
  /** Los dígitos del texto, si son 3 o más; si no, `null`. */
  digits: string | null;
}

/** La búsqueda de `q`, o `null` si viene vacía. */
export function renterSearchOf(q: string | undefined): RenterSearch | null {
  const term = q?.trim() ?? '';
  if (term === '') return null;

  const digits = term.replace(/\D/g, '');

  return {
    term,
    words: term.split(/\s+/).filter((word) => word !== ''),
    digits: digits.length >= SEARCH_MIN_DIGITS ? digits : null,
  };
}

/** `true` si el cliente coincide con la búsqueda. Sin distinguir mayúsculas. */
export function matchesRenterSearch(
  renter: Pick<Renter, 'fullName' | 'documentId' | 'licenseNumber' | 'mobilePhone' | 'phone'>,
  search: RenterSearch,
): boolean {
  const name = renter.fullName.toLowerCase();
  if (search.words.every((word) => name.includes(word.toLowerCase()))) return true;

  const term = search.term.toLowerCase();
  const fields = [renter.documentId, renter.licenseNumber, renter.mobilePhone, renter.phone];
  if (fields.some((value) => value?.toLowerCase().includes(term) === true)) return true;

  const { digits } = search;
  if (digits === null) return false;

  return [renter.documentId, renter.mobilePhone, renter.phone].some(
    (value) => value !== null && value.replace(/\D/g, '').includes(digits),
  );
}

/** Lo que importa de una renta para las cifras del cliente. */
export interface RentalForStats {
  status: string;
  actualPickupAt: Date | string | null;
}

/**
 * Las cifras del cliente (118): cuenta las rentas no canceladas, y la última
 * es la salida real más reciente que ya ocurrió (a `now` o antes).
 */
export function renterRentalStats(
  rentals: readonly RentalForStats[],
  now: Date,
): Pick<RenterListItem, 'rentalsCount' | 'lastRentalAt'> {
  const live = rentals.filter((rental) => rental.status !== 'CANCELLED');
  const pickups = live
    .map((rental) => (rental.actualPickupAt === null ? null : new Date(rental.actualPickupAt)))
    .filter((at): at is Date => at !== null && at.getTime() <= now.getTime())
    .map((at) => at.getTime());

  return {
    rentalsCount: live.length,
    lastRentalAt: pickups.length === 0 ? null : new Date(Math.max(...pickups)).toISOString(),
  };
}

/** Por nombre y después por `id`: el orden estable de siempre. */
export function compareByName(left: RenterListItem, right: RenterListItem): number {
  return left.fullName.localeCompare(right.fullName) || left.id.localeCompare(right.id);
}

/** La renta más reciente primero; los que nunca rentaron, al final y por nombre. */
export function compareByRecent(left: RenterListItem, right: RenterListItem): number {
  if (left.lastRentalAt !== right.lastRentalAt) {
    if (left.lastRentalAt === null) return 1;
    if (right.lastRentalAt === null) return -1;

    return right.lastRentalAt.localeCompare(left.lastRentalAt);
  }

  return compareByName(left, right);
}
