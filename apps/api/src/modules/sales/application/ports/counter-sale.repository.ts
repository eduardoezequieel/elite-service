import type { CounterSale, CounterSaleStatus, Page } from '@elite/shared';

/**
 * La venta suelta, del lado de lectura (065, 066).
 *
 * Lo que se escribe al vender o anular no pasa por aca: la venta nace y muere
 * con su cuenta de la 059, y la cuenta la escribe `ChargeUseCases` en una sola
 * transaccion —con o sin lavados—. Este puerto solo lee lo que quedo.
 */
export interface CounterSaleListFilter {
  /** Dia civil `YYYY-MM-DD` en la zona del taller. */
  date: string;
  status?: CounterSaleStatus;
  page: number;
  pageSize: number;
}

/** Las ventas de un dia, enteras: «Ventas del dia» las mezcla con los abonos (106). */
export type CounterSaleDayFilter = Pick<CounterSaleListFilter, 'date' | 'status'>;

export interface CounterSaleRepository {
  findById(id: string): Promise<CounterSale | null>;
  /** Mas recientes primero. */
  list(filter: CounterSaleListFilter): Promise<Page<CounterSale>>;
  /** Todas las del dia, mas recientes primero (106). Un dia de mostrador son decenas. */
  listDay(filter: CounterSaleDayFilter): Promise<CounterSale[]>;
}

export const COUNTER_SALE_REPOSITORY = Symbol('sales.CounterSaleRepository');
