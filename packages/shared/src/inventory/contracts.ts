/**
 * spec 065 — Inventario: formas que devuelve `/api/inventory` y
 * `GET /api/floor/inventory-items`.
 *
 * Dinero con dos decimales y cantidades con tres, siempre como cadena decimal
 * (`"14.00"`, `"2.500"`): el backend las guarda en `Decimal` y no las pasa por
 * un `number` de JavaScript.
 */

/** Un artículo, un tipo, fijo desde el alta (RN-1). */
export const INVENTORY_ITEM_KINDS = ['PRODUCT', 'SUPPLY'] as const;
export type InventoryItemKind = (typeof INVENTORY_ITEM_KINDS)[number];

/** Qué movió la existencia (RN-2). */
export const INVENTORY_MOVEMENT_TYPES = [
  'ENTRY',
  'SALE',
  'SALE_RETURN',
  'DISPATCH',
  'ADJUSTMENT',
  // spec 070: lo que un trabajador toma (−) y su anulación (+).
  'CONSUMPTION',
  'CONSUMPTION_RETURN',
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

/** Sugerencias para el campo unidad. Es texto libre: esto no es un catálogo (RN-16). */
export const INVENTORY_UNIT_SUGGESTIONS = ['unidad', 'litro', 'galón', 'par', 'caja'] as const;

/** Categoría propia del inventario, no la de servicios (RN-16). */
export interface InventoryCategory {
  id: string;
  /** De productos o de insumos, fijo al crearla (072). */
  kind: InventoryItemKind;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** Un artículo del inventario, como lo ve oficina (`inventory.read`). */
export interface InventoryItem {
  id: string;
  /** `INV-0001`, generado por el API (RN-15). */
  code: string;
  barcode: string | null;
  name: string;
  kind: InventoryItemKind;
  category: Pick<InventoryCategory, 'id' | 'name'> | null;
  /** Texto libre: `unidad`, `litro`, `par`… (RN-16). */
  unit: string;
  /** Precio de venta con IVA. `"0.00"` en un `SUPPLY` (RN-1). */
  price: string;
  taxRate: string;
  /** Costo promedio ponderado (RN-11). */
  averageCost: string;
  /** Existencia actual, tres decimales. Copia del último `balanceAfter` (RN-2). */
  stockOnHand: string;
  /** Mínimo, tres decimales. `"0.000"` = sin alerta (RN-13). */
  minStock: string;
  /** `minStock > 0 && stockOnHand <= minStock`. Lo calcula el API (RN-13). */
  isLowStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Un producto visto desde la pista (`GET /api/floor/inventory-items`) o desde el
 * selector del lavado: sin costos (RN-17). La UI muestra «Hay N» con
 * `stockOnHand`.
 */
export interface InventoryItemOption {
  id: string;
  /** `INV-0001` (RN-15). Texto secundario en los selectores. */
  code: string;
  name: string;
  price: string;
  unit: string;
  stockOnHand: string;
}

/**
 * Un empleado activo al que se le puede despachar (`GET /api/inventory/employees`,
 * RN-10). Solo id y nombre: despachar pide `inventory.move`, no `employees.read`.
 */
export interface InventoryEmployeeOption {
  id: string;
  fullName: string;
}

/** Quien registró un movimiento: un usuario de oficina o un empleado de pista. */
export interface InventoryMovementActor {
  kind: 'user' | 'employee';
  id: string;
  fullName: string;
}

/**
 * Una fila del kardex (RN-2). Append-only: nunca se edita ni se borra.
 *
 * `quantity` lleva signo (+ entra, − sale). Las referencias vienen resueltas
 * para que la tabla no pida nada más: el lavado con su folio, la venta con su
 * número y el empleado que recibió un despacho.
 */
export interface InventoryMovement {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  type: InventoryMovementType;
  /** Con signo, tres decimales: `"-2.000"`, `"10.000"`. */
  quantity: string;
  /** Existencia después del movimiento, tres decimales. */
  balanceAfter: string;
  /** Solo `ENTRY`, si trajo costo (RN-11). */
  unitCost: string | null;
  /** Solo `ENTRY`: factura o proveedor, texto libre. */
  reference: string | null;
  /** Motivo del `ADJUSTMENT` (obligatorio) o nota del `DISPATCH` (opcional). */
  reason: string | null;
  /** `SALE` / `SALE_RETURN` de un lavado. */
  workOrderId: string | null;
  /** Folio del lavado, `CW-0014`. */
  ticketNumber: string | null;
  /** `SALE` / `SALE_RETURN` de una venta suelta. */
  counterSaleId: string | null;
  /** Número de la venta, `V-0001`. */
  saleNumber: string | null;
  /** `DISPATCH`: quien recibió (RN-10). `CONSUMPTION` / `CONSUMPTION_RETURN`: quien tomó (070). */
  employee: { id: string; fullName: string } | null;
  /** `CONSUMPTION` / `CONSUMPTION_RETURN`: precio de venta congelado al anotar (070 RN-4). */
  unitPrice: string | null;
  /** `CONSUMPTION_RETURN`: el consumo que anula (070 RN-6). */
  reversesMovementId: string | null;
  /** Quien lo registró. `null` si no se pudo atribuir. */
  createdBy: InventoryMovementActor | null;
  /** ISO. */
  createdAt: string;
}

/** Respuesta de entrada, despacho y ajuste: el artículo ya actualizado y su movimiento. */
export interface InventoryMovementResult {
  item: InventoryItem;
  movement: InventoryMovement;
}

// --- spec 070: consumo de empleados ---

/** El trabajador de un reporte de consumo; puede estar inactivo y seguir saliendo. */
export interface ConsumptionEmployee {
  id: string;
  fullName: string;
  isActive: boolean;
}

/** Una fila del reporte mensual: lo que tomó un trabajador, sin los anulados (RN-5). */
export interface EmployeeConsumptionRow {
  employee: ConsumptionEmployee;
  /** Unidades, tres decimales. */
  units: string;
  /** Valor a precio de venta congelado, dos decimales (RN-4). */
  total: string;
}

/**
 * `GET /api/inventory/consumptions?month=`: el mes por trabajador, de mayor a
 * menor valor. Quien no consumió nada no sale.
 */
export interface EmployeeConsumptionReport {
  /** `YYYY-MM`. */
  month: string;
  total: string;
  rows: EmployeeConsumptionRow[];
}

/** La anulación de un consumo (RN-6). */
export interface ConsumptionReversal {
  movementId: string;
  /** ISO. */
  createdAt: string;
  createdBy: InventoryMovementActor | null;
  reason: string;
}

/** Un consumo en el detalle de un trabajador. */
export interface EmployeeConsumptionEntry {
  /** El `CONSUMPTION`: lo que se anula con `POST /consumptions/:movementId/reverse`. */
  movementId: string;
  /** ISO. */
  createdAt: string;
  item: { id: string; code: string; name: string; unit: string };
  /** Positiva, tres decimales. */
  quantity: string;
  unitPrice: string;
  /** `unitPrice × quantity`, dos decimales. */
  total: string;
  /** Quien lo anotó (RN-3). */
  createdBy: InventoryMovementActor | null;
  note: string | null;
  reversal: ConsumptionReversal | null;
}

/**
 * `GET /api/inventory/consumptions/:employeeId?month=`. Trae también los
 * anulados, marcados; `units` y `total` no los cuentan. Más reciente arriba.
 */
export interface EmployeeConsumptionDetail {
  month: string;
  employee: ConsumptionEmployee;
  units: string;
  total: string;
  entries: EmployeeConsumptionEntry[];
}
