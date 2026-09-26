import type { TicketChargeRef, TicketPayment } from '@elite/shared';

import {
  isCharged,
  jointChargeLabel,
  paidAtOf,
  paymentMethodsLabel,
  paymentsTotalCents,
  voidChargeWarning,
} from './ticket-payments';

function payment(overrides: Partial<TicketPayment> = {}): TicketPayment {
  return {
    method: 'CASH',
    amount: '14.00',
    paidAt: '2026-09-20T20:21:00.000Z',
    recordedBy: { id: 'u-1', fullName: 'Administrador' },
    ...overrides,
  };
}

function charge(overrides: Partial<TicketChargeRef> = {}): TicketChargeRef {
  return {
    id: 'c-1',
    number: 'C-0007',
    ticketCount: 1,
    total: '60.50',
    cashTendered: null,
    changeGiven: null,
    counterSale: null,
    ...overrides,
  };
}

describe('lo que el lavado dice de su cobro (059)', () => {
  it('sin pagos no está cobrado y no tiene método', () => {
    expect(isCharged([])).toBe(false);
    expect(paymentMethodsLabel([])).toBeNull();
    expect(paidAtOf([])).toBeNull();
  });

  it('un cobro partido nombra los dos métodos', () => {
    const payments = [payment({ amount: '10.00' }), payment({ method: 'CARD', amount: '4.00' })];

    expect(paymentMethodsLabel(payments)).toBe('Efectivo + Tarjeta');
    expect(paymentsTotalCents(payments)).toBe(1400);
  });

  it('dos renglones del mismo método siguen siendo un método', () => {
    expect(paymentMethodsLabel([payment(), payment()])).toBe('Efectivo');
  });

  it('la hora del cobro es la de la primera fila', () => {
    expect(paidAtOf([payment(), payment({ paidAt: '2026-09-20T21:00:00.000Z' })])).toBe(
      '2026-09-20T20:21:00.000Z',
    );
  });
});

describe('la cuenta mancomunada en la ficha (059 RN-8)', () => {
  it('una cuenta de un solo lavado no aclara nada', () => {
    expect(jointChargeLabel(null)).toBeNull();
    expect(jointChargeLabel(charge())).toBeNull();
    expect(voidChargeWarning(charge())).toBeNull();
  });

  it('con más de un lavado dice con cuántos se cobró', () => {
    expect(jointChargeLabel(charge({ ticketCount: 2 }))).toBe('Cobrado junto con otro lavado');
    expect(jointChargeLabel(charge({ ticketCount: 3 }))).toBe('Cobrado junto con otros 2 lavados');
  });

  it('y avisa que deshacerlo los deshace a todos', () => {
    expect(voidChargeWarning(charge({ ticketCount: 3 }))).toContain('3 lavados');
  });

  it('con productos sueltos nombra la venta y avisa que se anula (066)', () => {
    const sale = { id: 's-1', number: 'V-0003' };

    expect(jointChargeLabel(charge({ counterSale: sale }))).toBe(
      'Cobrado junto con la venta V-0003',
    );
    expect(jointChargeLabel(charge({ ticketCount: 2, counterSale: sale }))).toBe(
      'Cobrado junto con otro lavado y la venta V-0003',
    );
    expect(voidChargeWarning(charge({ counterSale: sale }))).toContain('la venta se anula');
    expect(voidChargeWarning(charge({ ticketCount: 2, counterSale: sale }))).toContain(
      '2 lavados y la venta V-0003',
    );
  });
});
