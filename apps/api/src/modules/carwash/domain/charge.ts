import type { PaymentMethod } from '@elite/shared';

import type { Cents } from './money';

/**
 * La cuenta de cobro (059): reglas puras, sin Nest ni Prisma.
 *
 * Lo que decide este modulo es **cuanto** y **a quien**: que la suma de los
 * renglones sea exactamente el total, cuanto vuelto se le da al cliente, y como
 * se reparte cada renglon entre las partes de la cuenta. Quien puede cobrar y
 * contra que turno se escribe se decide en la capa de aplicacion.
 *
 * Una **parte** (bucket) es cada cosa de la cuenta que guarda lo suyo: cada
 * lavado y, si la cuenta lleva productos sueltos, la venta suelta (066). Para
 * el reparto no hay diferencia: todas son un total en centavos.
 */

/** Un renglon del cobro: un metodo y su monto, en centavos. */
export interface ChargeLine {
  method: PaymentMethod;
  amount: Cents;
}

/** Por que una cuenta no se puede cobrar. */
export type ChargeAccountRejection = 'EMPTY_TOTAL' | 'AMOUNT_MISMATCH' | 'CASH_TENDERED_SHORT';

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((sum, value) => sum + value, 0);
}

/** Lo que hay que cobrar en efectivo, sumando los renglones `CASH` (RN-10). */
export function cashPortionOf(lines: readonly ChargeLine[]): Cents {
  return sumCents(lines.filter((line) => line.method === 'CASH').map((line) => line.amount));
}

/**
 * Valida la cuenta completa (RN-3, RN-10).
 *
 * - El total tiene que ser mayor que cero: una cuenta en cero es una cortesia,
 *   y una cortesia no se cobra, se anula (003 RN-5).
 * - La suma de los renglones tiene que ser **igual** al total. Ni de mas ni de
 *   menos: lo que el cliente entrega en efectivo es otra cosa y va aparte.
 * - Lo entregado en efectivo nunca puede ser menor que el efectivo a cobrar.
 *
 * Devuelve `null` si la cuenta procede, o el motivo del rechazo.
 */
export function rejectChargeAccount(
  bucketTotals: readonly Cents[],
  lines: readonly ChargeLine[],
  cashTendered: Cents | null,
): ChargeAccountRejection | null {
  const total = sumCents(bucketTotals);

  if (total <= 0) return 'EMPTY_TOTAL';
  if (sumCents(lines.map((line) => line.amount)) !== total) return 'AMOUNT_MISMATCH';

  const cash = cashPortionOf(lines);

  if (cashTendered !== null && cash > 0 && cashTendered < cash) return 'CASH_TENDERED_SHORT';

  return null;
}

/** Lo entregado y el vuelto, tal como quedan guardados en la cuenta (RN-10). */
export interface CashSettlement {
  cashTendered: Cents | null;
  changeGiven: Cents | null;
}

/**
 * Resuelve efectivo entregado y vuelto (RN-10).
 *
 * Sin `cashTendered` se asume pago justo y los dos quedan en `null`, que es lo
 * que la pantalla lee como «no hubo vuelto que dar». Si el cobro no tiene nada
 * en efectivo, lo entregado tampoco se guarda: seria un dato sin cobro detras.
 */
export function settleCash(
  lines: readonly ChargeLine[],
  cashTendered: Cents | null,
): CashSettlement {
  const cash = cashPortionOf(lines);

  if (cashTendered === null || cash <= 0) return { cashTendered: null, changeGiven: null };

  return { cashTendered, changeGiven: cashTendered - cash };
}

/**
 * Reparte un entero entre varios pesos, por resto mayor (RN-5).
 *
 * Cada parte es la proporcion del peso redondeada hacia abajo, y los centavos
 * que sobran se le dan uno a uno a los de mayor resto. **La suma de las partes
 * es siempre exactamente `amount`**: es la razon de ser de este algoritmo, y no
 * la cumple repartir con `Math.round` cada parte por su cuenta.
 *
 * Empate de restos: gana el de menor indice, para que el reparto sea
 * determinista y dos cobros iguales escriban lo mismo.
 *
 * Sin peso total —todos en cero— no hay proporcion que valga: todo va al
 * primero, que es mejor que perder el monto o repartirlo al azar.
 */
export function splitByLargestRemainder(amount: Cents, weights: readonly Cents[]): Cents[] {
  if (weights.length === 0) return [];

  const totalWeight = sumCents(weights);

  if (totalWeight <= 0) return weights.map((_, index) => (index === 0 ? amount : 0));

  const shares = weights.map((weight) => Math.floor((amount * weight) / totalWeight));
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: (amount * weight) % totalWeight,
  }));

  let leftover = amount - sumCents(shares);

  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const entry of remainders) {
    if (leftover <= 0) break;
    shares[entry.index] += 1;
    leftover -= 1;
  }

  return shares;
}

/**
 * Reparte cada renglon del cobro entre las partes de la cuenta —cada lavado y,
 * si la hay, la venta suelta (066)—, proporcional al total de cada una (RN-5).
 * El cajero nunca reparte a mano.
 *
 * Devuelve, por parte y en el orden de `bucketTotals`, un renglon por cada
 * metodo de la cuenta —en el mismo orden en que llegaron— con lo que le toco.
 * Se devuelven tambien las partes en cero: son las filas que atan una parte de
 * total cero a su cuenta, y sin ellas quedaria cobrada sin cobro al que
 * pertenecer.
 */
export function allocateLines(
  lines: readonly ChargeLine[],
  bucketTotals: readonly Cents[],
): ChargeLine[][] {
  const perLine = lines.map((line) => ({
    method: line.method,
    shares: splitByLargestRemainder(line.amount, bucketTotals),
  }));

  return bucketTotals.map((_, bucketIndex) =>
    perLine.map((line) => ({ method: line.method, amount: line.shares[bucketIndex] ?? 0 })),
  );
}
