import type { CounterSale, Page } from '@elite/shared';

import type { CashSessionRepository } from '../../../carwash/application/ports/cash-session.repository';
import type {
  InMemoryChargeRepository,
  InMemorySale,
} from '../../../carwash/application/testing/in-memory-charge.repository';
import { isSaleVoidable } from '../../domain/counter-sale';
import type {
  CounterSaleListFilter,
  CounterSaleRepository,
} from '../ports/counter-sale.repository';

/**
 * La venta suelta en memoria, del lado de lectura (065, 066). Lee las ventas
 * que escribio la cuenta en memoria: igual que en la base, la venta nace y
 * muere con su cuenta, y este repositorio solo mira lo que quedo.
 */
export class InMemoryCounterSaleRepository implements CounterSaleRepository {
  constructor(
    private readonly charges: InMemoryChargeRepository,
    private readonly cashSessions: Pick<CashSessionRepository, 'findOpen'>,
  ) {}

  async findById(id: string): Promise<CounterSale | null> {
    const stored = this.charges.sales.get(id);

    return stored === undefined ? null : this.read(stored);
  }

  async list(filter: CounterSaleListFilter): Promise<Page<CounterSale>> {
    const matching = await Promise.all(
      [...this.charges.sales.values()]
        .filter((stored) => stored.date === filter.date)
        .filter((stored) => filter.status === undefined || stored.sale.status === filter.status)
        .reverse()
        .map((stored) => this.read(stored)),
    );
    const start = (filter.page - 1) * filter.pageSize;

    return {
      items: matching.slice(start, start + filter.pageSize),
      page: filter.page,
      pageSize: filter.pageSize,
      total: matching.length,
    };
  }

  /** `isVoidable` se calcula al leer, contra el turno abierto de ahora (RN-22). */
  private async read(stored: InMemorySale): Promise<CounterSale> {
    const open = await this.cashSessions.findOpen();
    const isOpen = open !== null && stored.cashSessionId === open.id;

    return {
      ...stored.sale,
      isVoidable: isSaleVoidable(
        stored.sale.status,
        stored.sale.payments.map(() => ({ isOpen })),
      ),
    };
  }
}
