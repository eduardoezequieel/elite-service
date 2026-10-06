import { cashPaymentOrigin } from './cash-origin';

describe('de qué es un cobro del turno (065, 106)', () => {
  const base = {
    workOrderId: null,
    ticketNumber: null,
    counterSaleId: null,
    saleNumber: null,
    tabId: null,
    tabNumber: null,
  };

  it('un abono lleva a su cuenta y la nombra', () => {
    expect(cashPaymentOrigin({ ...base, tabId: 't1', tabNumber: 'C-0012' })).toEqual({
      number: 'C-0012',
      href: '/sales/tabs/t1',
      label: 'Cuenta C-0012',
    });
  });

  it('una venta suelta lleva a la venta y un lavado al lavado', () => {
    expect(cashPaymentOrigin({ ...base, counterSaleId: 's1', saleNumber: 'V-0003' })).toEqual({
      number: 'V-0003',
      href: '/sales/s1',
      label: null,
    });
    expect(cashPaymentOrigin({ ...base, workOrderId: 'w1', ticketNumber: 'CW-0014' })).toEqual({
      number: 'CW-0014',
      href: '/carwash/w1',
      label: null,
    });
  });
});
