import { centsToMoney, moneyToCents } from '@elite/shared';
import type { AgreementStatus, Page } from '@elite/shared';

/**
 * Las otras rentas del cliente en la ficha de una renta (128): cuántas tiene,
 * cuánto debe en las devueltas y las más recientes. Puro.
 */

/** Filas que muestra la ficha; el resto vive en la ficha del cliente. */
export const OTHER_RENTALS_SHOWN = 3;

/** Lo que se lee de cada renta. */
export interface OtherRentalSource {
  id: string;
  status: AgreementStatus;
  totals: { balance: string };
}

export interface OtherRentals<T> {
  /** Todas sus rentas menos la abierta, de cualquier estado. */
  count: number;
  /** Saldo pendiente de las devueltas cargadas, como monto del API. */
  owed: string | null;
  rows: T[];
}

/** `page` es la primera página de las rentas del cliente, la más reciente arriba. */
export function otherRentals<T extends OtherRentalSource>(
  page: Page<T>,
  currentId: string,
): OtherRentals<T> {
  const others = page.items.filter((agreement) => agreement.id !== currentId);
  const owedCents = others
    .filter((agreement) => agreement.status === 'FINISHED')
    .reduce((sum, agreement) => sum + Math.max(0, moneyToCents(agreement.totals.balance)), 0);

  return {
    count: Math.max(0, page.total - 1),
    owed: owedCents > 0 ? centsToMoney(owedCents) : null,
    rows: others.slice(0, OTHER_RENTALS_SHOWN),
  };
}
