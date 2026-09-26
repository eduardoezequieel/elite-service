import type { Milli } from '../../inventory/domain/stock';

/**
 * Lo que las lineas de producto de un lavado le hacen al inventario (065).
 *
 * Reglas puras: se comparan las lineas de antes con las de despues y sale la
 * lista de movimientos. Quien los escribe —dentro de la misma transaccion que
 * el ticket— es la infraestructura.
 */

/** Una linea de producto, reducida a lo que mueve existencia. */
export interface ProductQuantity {
  inventoryItemId: string;
  /** En milesimas, mayor que cero. */
  quantity: Milli;
}

/** Un movimiento de kardex que provoca el lavado. */
export interface ProductStockChange {
  inventoryItemId: string;
  /** `SALE` saca, `SALE_RETURN` repone (RN-4, RN-5). */
  type: 'SALE' | 'SALE_RETURN';
  /** Con signo, en milesimas: − en `SALE`, + en `SALE_RETURN`. Nunca 0. */
  quantity: Milli;
}

function totalsById(lines: readonly ProductQuantity[]): Map<string, Milli> {
  const totals = new Map<string, Milli>();

  for (const line of lines) {
    totals.set(line.inventoryItemId, (totals.get(line.inventoryItemId) ?? 0) + line.quantity);
  }

  return totals;
}

/**
 * La diferencia por articulo entre lo que el lavado tenia y lo que queda
 * (RN-4). `PATCH items` reemplaza las lineas enteras (017), asi que no se
 * vende ni se devuelve la linea: se vende o se devuelve **lo que cambio**.
 *
 * - mas cantidad (o linea nueva) → `SALE` por la diferencia, con signo −;
 * - menos cantidad (o linea quitada) → `SALE_RETURN` por la diferencia, +;
 * - misma cantidad → nada.
 *
 * Sale ordenado por articulo: dos ediciones simultaneas bloquean las filas del
 * inventario en el mismo orden y no se traban una a la otra.
 */
export function productStockChanges(
  before: readonly ProductQuantity[],
  after: readonly ProductQuantity[],
): ProductStockChange[] {
  const previous = totalsById(before);
  const next = totalsById(after);
  const ids = [...new Set([...previous.keys(), ...next.keys()])].sort();
  const changes: ProductStockChange[] = [];

  for (const inventoryItemId of ids) {
    const delta = (next.get(inventoryItemId) ?? 0) - (previous.get(inventoryItemId) ?? 0);

    if (delta > 0) {
      changes.push({ inventoryItemId, type: 'SALE', quantity: -delta });
    } else if (delta < 0) {
      changes.push({ inventoryItemId, type: 'SALE_RETURN', quantity: -delta });
    }
  }

  return changes;
}

/** Anular el lavado repone cada producto que tenia (RN-5). */
export function productReturnsOnVoid(lines: readonly ProductQuantity[]): ProductStockChange[] {
  return productStockChanges(lines, []);
}
