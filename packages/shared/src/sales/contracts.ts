/**
 * spec 065 — Venta suelta: lo que devuelve `/api/sales`.
 *
 * Una venta nace cobrada (RN-18): no hay ventas abiertas. Se anula, no se borra,
 * porque el kardex la referencia (RN-22). Dinero con dos decimales y cantidades
 * con tres, como cadena decimal.
 */

import type { ChargePayment } from '../contracts';
import type { TabPaymentEntry } from '../tabs/contracts';

export const COUNTER_SALE_STATUSES = ['PAID', 'VOID'] as const;
export type CounterSaleStatus = (typeof COUNTER_SALE_STATUSES)[number];

/** Una línea de la venta: snapshot del artículo al venderlo (RN-6, RN-21). */
export interface CounterSaleItem {
  id: string;
  inventoryItemId: string;
  /** Snapshot del código, `INV-0003`. */
  code: string;
  /** Snapshot del nombre. */
  name: string;
  /** Precio del artículo al venderlo. Techo del precio unitario. */
  catalogPrice: string;
  unitPrice: string;
  /** Tres decimales. */
  quantity: string;
  /** `unitPrice × quantity`, dos decimales. */
  total: string;
  /** Quien firmó un precio por debajo del catálogo (060). `null` = precio de catálogo. */
  priceAuthorizedBy: { id: string; fullName: string } | null;
  priceReason: string | null;
  sortOrder: number;
}

/** Una venta suelta, `V-0001`. */
export interface CounterSale {
  id: string;
  /** `V-0001`. */
  number: string;
  status: CounterSaleStatus;
  /** Nombre libre, sin ficha de cliente ni carro (RN-21). */
  customerName: string | null;
  /** Suma de `items[].total`, igual a la suma de los pagos. */
  total: string;
  items: CounterSaleItem[];
  /**
   * Los pagos de la cuenta de la 059 que la cobró. Vacío tras anularla: el cobro
   * y sus pagos salen del turno (RN-22).
   */
  payments: ChargePayment[];
  /** La cuenta (`C-0007`). `null` tras anular. */
  charge: { id: string; number: string } | null;
  /**
   * Los lavados cobrados en la misma cuenta (066): «Cobrada con #7, #8». Vacío
   * si la venta se cobró sola o tras anularla.
   */
  accountTickets: { id: string; number: string }[];
  /** Efectivo entregado y vuelto (059 RN-10). `null` si no hubo o tras anular. */
  cashTendered: string | null;
  changeGiven: string | null;
  /** Quien vendió y cobró. */
  createdBy: { id: string; fullName: string };
  /** ISO. */
  createdAt: string;
  voidedBy: { id: string; fullName: string } | null;
  voidedAt: string | null;
  voidReason: string | null;
  /**
   * `true` si todavía se puede anular: está `PAID` y sus pagos son del turno
   * abierto (RN-22). Lo calcula el API al leer; la web no repite la regla.
   */
  isVoidable: boolean;
}

/**
 * spec 106 — Una fila de «Ventas del día» (`GET /sales/feed`): una venta suelta
 * o un abono a una cuenta abierta («De cuenta»). `at` es la hora de la fila
 * (`createdAt` de la venta, `paidAt` del abono), ISO.
 */
export type SalesFeedEntry =
  | { kind: 'SALE'; at: string; sale: CounterSale }
  | { kind: 'TAB_PAYMENT'; at: string; tabPayment: TabPaymentEntry };
