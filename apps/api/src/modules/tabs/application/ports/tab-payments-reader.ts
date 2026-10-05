import type { TabPaymentEntry } from '@elite/shared';

/**
 * Los abonos de un día (106), para «Ventas del día» (`GET /sales/feed`). Lo
 * exporta `TabsModule` y lo consume la venta suelta, igual que el lector de
 * gastos de la 099: la venta no lee la tabla de cuentas por su cuenta.
 */
export interface TabPaymentsReader {
  /** Los abonos del día civil `YYYY-MM-DD` en la zona del taller, el más nuevo primero. */
  paymentsOn(date: string): Promise<TabPaymentEntry[]>;
}

export const TAB_PAYMENTS_READER = Symbol('tabs.TabPaymentsReader');
