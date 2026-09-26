import type { InventoryItemOption } from '@elite/shared';

import type { Cents } from '../../domain/money';

/**
 * Lo que el lavado necesita saber de un articulo del inventario para ponerlo
 * en una linea (065 RN-6): el snapshot de codigo, nombre, precio e IVA, y si se
 * puede vender. La existencia no viaja aca: la valida el kardex, con la fila
 * bloqueada, dentro de la transaccion que guarda el ticket (RN-3).
 */
export interface InventoryProductRecord {
  id: string;
  code: string;
  name: string;
  kind: 'PRODUCT' | 'SUPPLY';
  isActive: boolean;
  /** Precio de venta con IVA. Techo del descuento de la linea (RN-7). */
  price: Cents;
  /** `"0.1300"`, igual que el de un servicio. */
  taxRate: string;
}

export interface InventoryCatalog {
  /** Los que existan de esos ids, activos o no. Los que no existen, no vienen. */
  findByIds(ids: readonly string[]): Promise<InventoryProductRecord[]>;
  /**
   * Productos activos para el selector del lavado y de la venta suelta
   * (RN-17). Sin costos. `search` busca por nombre, codigo o barcode.
   */
  listOptions(search?: string): Promise<InventoryItemOption[]>;
}

export const INVENTORY_CATALOG = Symbol('carwash.InventoryCatalog');
