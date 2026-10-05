import type {
  CounterSale,
  InventoryItemOption,
  Page,
  SalesFeedEntry,
  SalesFeedQuery,
  VoidCounterSaleInput,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * API de la venta suelta (065 RN-18 a RN-22), desde la oficina.
 *
 * Vender no está acá: la web cobra la venta con `POST /carwash/charges`, la
 * misma cuenta del lavado, con o sin lavados sumados (066). `POST /sales`
 * sigue en el API para quien lo use, con su contrato de la 065.
 *
 * Los productos que se ofrecen salen de `GET /carwash/inventory-items`, el
 * mismo selector del lavado: pide `carwash.read` y no `inventory.read`, y no
 * trae costos.
 */

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams(
    Object.entries(params)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();

  return search === '' ? '' : `?${search}`;
}

/** «Ventas del día» (106): ventas sueltas y abonos a cuentas, lo más nuevo primero. */
export function listSalesFeed(params: Partial<SalesFeedQuery> = {}): Promise<Page<SalesFeedEntry>> {
  return apiFetch<Page<SalesFeedEntry>>(`/sales/feed${query(params)}`);
}

export function getSale(id: string): Promise<CounterSale> {
  return apiFetch<CounterSale>(`/sales/${id}`);
}

export function voidSale(id: string, input: VoidCounterSaleInput): Promise<CounterSale> {
  return apiFetch<CounterSale>(`/sales/${id}/void`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Productos activos que se pueden vender, por nombre, código o código de barras. */
export function listSellableItems(search: string): Promise<InventoryItemOption[]> {
  return apiFetch<InventoryItemOption[]>(
    `/carwash/inventory-items${query({ search: search === '' ? undefined : search })}`,
  );
}
