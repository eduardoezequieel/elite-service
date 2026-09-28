import type { CounterSale } from '@elite/shared';

import {
  accountTicketsLabel,
  paymentMethodsOf,
  productsSummary,
  saleDate,
  saleTime,
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
  it('la hora y la fecha son las del taller, no las del navegador', () => {
    // 16:30 UTC son las 10:30 en El Salvador (UTC−6).
    expect(saleTime('2026-09-26T16:30:00.000Z')).toBe('10:30 a.m.');
    // 03:00 UTC del 27 es todavía el 26 en el taller.
    expect(saleDate('2026-09-27T03:00:00.000Z')).toMatch(/^Sábado, 26 de septiembre de 2026$/);
  });

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
