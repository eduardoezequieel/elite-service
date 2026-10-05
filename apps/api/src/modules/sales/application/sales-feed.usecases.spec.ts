import { salesFeedQuerySchema } from '@elite/shared';
import type { CounterSale, Page, TabPaymentEntry } from '@elite/shared';

import type { TabPaymentsReader } from '../../tabs/application/ports/tab-payments-reader';
import type { CounterSaleDayFilter, CounterSaleRepository } from './ports/counter-sale.repository';
import { SalesFeedUseCases } from './sales-feed.usecases';

const PERSON = { id: 'user-1', fullName: 'Karla' };

function sale(id: string, createdAt: string, status: CounterSale['status'] = 'PAID'): CounterSale {
  return {
    id,
    number: `V-${id}`,
    status,
    customerName: null,
    total: '1.00',
    items: [],
    payments: [],
    charge: null,
    accountTickets: [],
    cashTendered: null,
    changeGiven: null,
    createdBy: PERSON,
    createdAt,
    voidedBy: null,
    voidedAt: null,
    voidReason: null,
    isVoidable: false,
  };
}

function abono(id: string, paidAt: string): TabPaymentEntry {
  return {
    id,
    method: 'CASH',
    amount: '3.00',
    paidAt,
    recordedBy: PERSON,
    bankAccount: null,
    reference: null,
    description: null,
    tab: {
      id: 'tab-1',
      number: 'C-0012',
      holder: { kind: 'EMPLOYEE', id: 'e1', fullName: 'Juan' },
    },
  };
}

class FakeSales implements CounterSaleRepository {
  lastDayFilter: CounterSaleDayFilter | null = null;

  constructor(private readonly rows: CounterSale[]) {}

  async findById(): Promise<CounterSale | null> {
    return null;
  }

  async list(): Promise<Page<CounterSale>> {
    return { items: [], page: 1, pageSize: 50, total: 0 };
  }

  async listDay(filter: CounterSaleDayFilter): Promise<CounterSale[]> {
    this.lastDayFilter = filter;

    return this.rows.filter((row) => filter.status === undefined || row.status === filter.status);
  }
}

class FakeTabPayments implements TabPaymentsReader {
  dates: string[] = [];

  constructor(private readonly rows: TabPaymentEntry[]) {}

  async paymentsOn(date: string): Promise<TabPaymentEntry[]> {
    this.dates.push(date);

    return this.rows;
  }
}

describe('SalesFeedUseCases (105)', () => {
  const sales = [
    sale('s1', '2026-10-05T15:00:00.000Z'),
    sale('s2', '2026-10-05T17:00:00.000Z', 'VOID'),
  ];
  const payments = [abono('p1', '2026-10-05T16:00:00.000Z')];

  it('mixes the day sales and tab payments, newest first', async () => {
    const feed = new SalesFeedUseCases(new FakeSales(sales), new FakeTabPayments(payments));

    const page = await feed.feed(salesFeedQuerySchema.parse({ date: '2026-10-05' }));

    expect(page.items.map((entry) => entry.kind)).toEqual(['SALE', 'TAB_PAYMENT', 'SALE']);
    expect(page.items[1]).toMatchObject({
      kind: 'TAB_PAYMENT',
      at: '2026-10-05T16:00:00.000Z',
      tabPayment: { tab: { number: 'C-0012' } },
    });
    expect(page.total).toBe(3);
  });

  it('keeps tab payments with PAID and leaves them out of VOID', async () => {
    const reader = new FakeTabPayments(payments);
    const feed = new SalesFeedUseCases(new FakeSales(sales), reader);

    const paid = await feed.feed(
      salesFeedQuerySchema.parse({ date: '2026-10-05', status: 'PAID' }),
    );
    const voided = await feed.feed(
      salesFeedQuerySchema.parse({ date: '2026-10-05', status: 'VOID' }),
    );

    expect(paid.items.map((entry) => entry.kind)).toEqual(['TAB_PAYMENT', 'SALE']);
    expect(voided.items.map((entry) => entry.kind)).toEqual(['SALE']);
    expect(reader.dates).toEqual(['2026-10-05']);
  });

  it('pages the merged list and defaults to today', async () => {
    const repository = new FakeSales(sales);
    const feed = new SalesFeedUseCases(repository, new FakeTabPayments(payments));

    const page = await feed.feed(salesFeedQuerySchema.parse({ page: '2', pageSize: '2' }));

    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(page.items).toHaveLength(1);
    expect(repository.lastDayFilter?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
