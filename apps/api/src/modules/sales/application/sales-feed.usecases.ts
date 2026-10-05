import type { Page, SalesFeedEntry, SalesFeedQuery } from '@elite/shared';

import { slicePage } from '../../../common/pagination/page';
import { civilDateInBusinessZone } from '../../carwash/domain/commission';
import type { TabPaymentsReader } from '../../tabs/application/ports/tab-payments-reader';
import type { CounterSaleRepository } from './ports/counter-sale.repository';

/**
 * «Ventas del día» (106): las ventas sueltas y los abonos a cuentas abiertas
 * del mismo día, en una sola lista, lo más nuevo primero.
 *
 * Se arma en memoria con `slicePage` (101): son dos tablas y un día de
 * mostrador son decenas de filas. Un abono cuenta como cobrado: sale con
 * `status=PAID` y no con `VOID`, porque un abono no se anula.
 */
export class SalesFeedUseCases {
  constructor(
    private readonly sales: CounterSaleRepository,
    private readonly tabPayments: TabPaymentsReader,
  ) {}

  async feed(query: SalesFeedQuery): Promise<Page<SalesFeedEntry>> {
    const date = query.date ?? civilDateInBusinessZone();
    const sales = await this.sales.listDay({ date, status: query.status });
    const payments = query.status === 'VOID' ? [] : await this.tabPayments.paymentsOn(date);
    const entries: SalesFeedEntry[] = [
      ...sales.map((sale): SalesFeedEntry => ({ kind: 'SALE', at: sale.createdAt, sale })),
      ...payments.map((tabPayment): SalesFeedEntry => ({
        kind: 'TAB_PAYMENT',
        at: tabPayment.paidAt,
        tabPayment,
      })),
    ];

    return slicePage(
      entries.sort((a, b) => b.at.localeCompare(a.at) || idOf(b).localeCompare(idOf(a))),
      query,
    );
  }
}

function idOf(entry: SalesFeedEntry): string {
  return entry.kind === 'SALE' ? entry.sale.id : entry.tabPayment.id;
}
