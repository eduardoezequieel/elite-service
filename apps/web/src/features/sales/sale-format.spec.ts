import type { CounterSale, SalesFeedEntry } from '@elite/shared';

import {
  accountTicketsLabel,
  feedEntryHref,
  feedEntryKey,
  feedFilterCount,
  filterFeed,
  paymentMethodsOf,
  productsSummary,
  summarizeFeed,
  summarizeSales,
} from './sale-format';

function sale(overrides: Partial<CounterSale> = {}): CounterSale {
  return {
    id: 's1',
    number: 'V-0001',
    status: 'PAID',
    customerName: null,
    total: '10.00',
    items: [],
    payments: [
      {
        id: 'p1',
        method: 'CASH',
        amount: '10.00',
        bankAccount: null,
        reference: null,
        description: null,
      },
    ],
    charge: { id: 'c1', number: 'C-0001' },
    accountTickets: [],
    cashTendered: null,
    changeGiven: null,
    createdBy: { id: 'u1', fullName: 'Ana Castillo' },
    createdAt: '2026-09-26T16:30:00.000Z',
    voidedBy: null,
    voidedAt: null,
    voidReason: null,
    isVoidable: true,
    ...overrides,
  };
}

describe('la venta suelta en pantalla (065)', () => {
  it('resume los productos con su cantidad', () => {
    expect(
      productsSummary([
        { name: 'Cera en pasta', quantity: '2.000' },
        { name: 'Shampoo', quantity: '1.500' },
      ]),
    ).toBe('Cera en pasta ×2, Shampoo ×1.5');
  });

  it('cada método una vez, en el orden en que entró', () => {
    expect(paymentMethodsOf([{ method: 'CARD' }, { method: 'CASH' }, { method: 'CARD' }])).toEqual([
      'CARD',
      'CASH',
    ]);
  });

  it('el día suma lo pagado y el efectivo; las anuladas solo se cuentan', () => {
    const summary = summarizeSales([
      sale(),
      sale({
        id: 's2',
        total: '8.00',
        payments: [
          {
            id: 'p2',
            method: 'CARD',
            amount: '5.00',
            bankAccount: null,
            reference: null,
            description: null,
          },
          {
            id: 'p3',
            method: 'CASH',
            amount: '3.00',
            bankAccount: null,
            reference: null,
            description: null,
          },
        ],
      }),
      sale({ id: 's3', status: 'VOID', total: '4.00', payments: [] }),
    ]);

    expect(summary).toEqual({ paidCount: 2, voidCount: 1, soldCents: 1800, cashCents: 1300 });
  });
});

describe('la cuenta de la venta (066)', () => {
  it('dice con qué lavados se cobró', () => {
    expect(
      accountTicketsLabel([
        { id: 't7', number: 'CW-0007' },
        { id: 't8', number: 'CW-0008' },
      ]),
    ).toBe('Cobrada con #7, #8');
  });

  it('una venta cobrada sola no aclara nada', () => {
    expect(accountTicketsLabel([])).toBeNull();
  });
});

describe('Ventas del día con abonos (105)', () => {
  const ACTOR = { id: 'u1', fullName: 'Ana Castillo' };

  function tabPayment(
    id: string,
    method: 'CASH' | 'CARD',
    amount: string,
  ): Extract<SalesFeedEntry, { kind: 'TAB_PAYMENT' }> {
    return {
      kind: 'TAB_PAYMENT',
      at: '2026-10-05T17:00:00.000Z',
      tabPayment: {
        id,
        method,
        amount,
        paidAt: '2026-10-05T17:00:00.000Z',
        recordedBy: ACTOR,
        bankAccount: null,
        reference: null,
        description: null,
        tab: {
          id: 't1',
          number: 'C-0012',
          holder: { kind: 'EMPLOYEE', id: 'e1', fullName: 'Juan Pérez' },
        },
      },
    };
  }

  const entries: SalesFeedEntry[] = [
    { kind: 'SALE', at: '2026-10-05T16:00:00.000Z', sale: sale({ id: 's1' }) },
    {
      kind: 'SALE',
      at: '2026-10-05T15:00:00.000Z',
      sale: sale({ id: 's2', status: 'VOID', payments: [], total: '4.00' }),
    },
    tabPayment('p1', 'CASH', '2.50'),
    tabPayment('p2', 'CARD', '1.00'),
  ];

  it('vendido son las ventas; en efectivo suma también los abonos en efectivo', () => {
    expect(summarizeFeed(entries)).toEqual({
      paidCount: 1,
      voidCount: 1,
      soldCents: 1000,
      cashCents: 1250,
      tabPaymentCount: 2,
    });
  });

  it('pagadas trae ventas y abonos; anuladas, solo ventas', () => {
    const summary = summarizeFeed(entries);

    expect(feedFilterCount(summary, 'all')).toBe(4);
    expect(feedFilterCount(summary, 'PAID')).toBe(3);
    expect(feedFilterCount(summary, 'VOID')).toBe(1);
    expect(filterFeed(entries, 'PAID').map(feedEntryKey)).toEqual([
      'sale:s1',
      'tab-payment:p1',
      'tab-payment:p2',
    ]);
    expect(filterFeed(entries, 'VOID').map(feedEntryKey)).toEqual(['sale:s2']);
    expect(filterFeed(entries, 'all')).toHaveLength(4);
  });

  it('una venta abre su ficha y un abono, su cuenta', () => {
    expect(feedEntryHref(entries[0] as SalesFeedEntry)).toBe('/sales/s1');
    expect(feedEntryHref(tabPayment('p3', 'CASH', '1.00'))).toBe('/sales/tabs/t1');
  });
});
