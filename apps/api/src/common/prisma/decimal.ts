import type { Prisma } from '@prisma/client';

import { fromDecimalString } from '../../modules/carwash/domain/money';
import type { Cents } from '../../modules/carwash/domain/money';
import { fromQuantityString } from '../../modules/inventory/domain/stock';
import type { Milli } from '../../modules/inventory/domain/stock';

/**
 * Del `Decimal` que entrega Prisma a los enteros del dominio (080).
 *
 * Pasa por la cadena con las cifras de la columna, nunca por `Number()`: el
 * dominio parsea a mano justamente para no heredar el error del flotante.
 */

/** Una columna `Decimal(12, 2)` de dinero, en centavos. */
export function decimalToCents(value: Prisma.Decimal): Cents {
  return fromDecimalString(value.toFixed(2));
}

/** Una columna `Decimal(12, 3)` de cantidad, en milésimas. */
export function decimalToMilli(value: Prisma.Decimal): Milli {
  return fromQuantityString(value.toFixed(3));
}
