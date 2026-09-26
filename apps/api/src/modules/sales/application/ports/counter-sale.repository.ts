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

export interface CounterSaleRepository {
  findById(id: string): Promise<CounterSale | null>;
  /** Mas recientes primero. */
  list(filter: CounterSaleListFilter): Promise<Page<CounterSale>>;
}

export const COUNTER_SALE_REPOSITORY = Symbol('sales.CounterSaleRepository');
