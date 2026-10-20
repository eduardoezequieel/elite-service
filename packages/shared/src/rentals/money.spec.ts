import {
  agreementTotals,
  billableDays,
  centsToMoney,
  damageChargeOf,
  discountCeiling,
  discountExceedsSubtotal,
  moneyToCents,
  netOf,
  rateForDays,
} from './money';

const BASE = {
  dailyRate: '35.00',
  cdwPerDay: '0.00',
  billableDays: 3,
  extraCharges: '0.00',
  extraKmCharge: '0.00',
  fuelCharge: '0.00',
  damageCharge: '0.00',
  finesCharged: '0.00',
  discount: '0.00',
  payments: [],
};

describe('billableDays (RN-4)', () => {
  const pickup = '2026-10-01T10:00:00-06:00';

  it('un día exacto es un día', () => {
    expect(billableDays(pickup, '2026-10-02T10:00:00-06:00', 1)).toBe(1);
  });

  it('dentro de la gracia no suma otro día', () => {
    expect(billableDays(pickup, '2026-10-02T10:59:00-06:00', 1)).toBe(1);
  });

  it('pasada la gracia cobra el día siguiente', () => {
    expect(billableDays(pickup, '2026-10-02T11:01:00-06:00', 1)).toBe(2);
  });

  it('sin gracia, un minuto de más ya es otro día', () => {
    expect(billableDays(pickup, '2026-10-02T10:01:00-06:00', 0)).toBe(2);
  });

  it('nunca menos de un día, aunque se devuelva enseguida', () => {
    expect(billableDays(pickup, '2026-10-01T12:00:00-06:00', 1)).toBe(1);
    expect(billableDays(pickup, pickup, 1)).toBe(1);
  });

  it('acepta Date', () => {
    expect(
      billableDays(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-08T00:00:00Z'), 1),
    ).toBe(7);
  });
});

describe('rateForDays (RN-3)', () => {
  const rates = { dailyRate: '35', weeklyRate: '30.00', monthlyRate: '25.5' };

  it('menos de 7 días: la diaria', () => {
    expect(rateForDays(rates, 6)).toBe('35.00');
  });

  it('desde 7 días: la semanal', () => {
    expect(rateForDays(rates, 7)).toBe('30.00');
    expect(rateForDays(rates, 29)).toBe('30.00');
  });

  it('desde 30 días: la mensual', () => {
    expect(rateForDays(rates, 30)).toBe('25.50');
  });

  it('sin mensual, a los 30 días sigue la semanal; sin semanal, la diaria', () => {
    expect(rateForDays({ dailyRate: '35.00', weeklyRate: '30.00' }, 45)).toBe('30.00');
    expect(rateForDays({ dailyRate: '35.00', weeklyRate: null, monthlyRate: null }, 45)).toBe(
      '35.00',
    );
  });

  it('una tarifa en cero no aplica', () => {
    expect(rateForDays({ dailyRate: '35.00', weeklyRate: '0.00' }, 10)).toBe('35.00');
  });
});

describe('agreementTotals (RN-5)', () => {
  it('(diaria + CDW) × días + cargos − descuento', () => {
    const totals = agreementTotals({
      ...BASE,
      cdwPerDay: '10.00',
      extraCharges: '15.00',
      extraKmCharge: '4.50',
      finesCharged: '20.00',
      discount: '5.00',
    });

    expect(totals.rental).toBe('135.00');
    expect(totals.total).toBe('169.50');
    expect(totals.balance).toBe('169.50');
  });

  it('el saldo descuenta los pagos y no cuenta los anulados', () => {
    const totals = agreementTotals({
      ...BASE,
      payments: [
        { amount: '50.00' },
        { amount: '20.00', voidedAt: null },
        { amount: '30.00', voidedAt: '2026-10-01T12:00:00Z' },
      ],
    });

    expect(totals.total).toBe('105.00');
    expect(totals.paid).toBe('70.00');
    expect(totals.balance).toBe('35.00');
  });

  it('un descuento mayor que todo deja el total en cero, no negativo', () => {
    expect(agreementTotals({ ...BASE, discount: '500.00' }).total).toBe('0.00');
  });

  it('cobrar de más deja el saldo negativo', () => {
    expect(agreementTotals({ ...BASE, payments: [{ amount: '110.00' }] }).balance).toBe('-5.00');
  });
});

describe('netOf (RN-5)', () => {
  it('con IVA 0 el neto es el total', () => {
    expect(netOf('113.00', '0.00', true)).toBe('113.00');
  });

  it('con IVA 13 incluido, total / 1.13', () => {
    expect(netOf('113.00', '13.00', true)).toBe('100.00');
    expect(netOf('100.00', '13', true)).toBe('88.50');
  });

  it('si la renta no incluye IVA, el neto es el total', () => {
    expect(netOf('113.00', '13.00', false)).toBe('113.00');
  });
});

describe('centavos', () => {
  it('ida y vuelta sin flotantes', () => {
    expect(moneyToCents('0.1')).toBe(10);
    expect(moneyToCents('-3')).toBe(-300);
    expect(centsToMoney(-5)).toBe('-0.05');
    expect(centsToMoney(123456)).toBe('1234.56');
  });

  it('rechaza lo que no es un monto', () => {
    expect(() => moneyToCents('abc')).toThrow();
  });
});

describe('discountCeiling (118 RN-1)', () => {
  it('suma tarifa y CDW por día, y los cargos', () => {
    expect(discountCeiling({ ...BASE, cdwPerDay: '5.00', extraCharges: '10.00' })).toBe('130.00');
    expect(discountCeiling({ ...BASE, extraKmCharge: '4.50', finesCharged: '20.00' })).toBe(
      '129.50',
    );
  });

  it('el descuento igual al tope vale; un centavo más, no', () => {
    expect(discountExceedsSubtotal('105.00', BASE)).toBe(false);
    expect(discountExceedsSubtotal('105.01', BASE)).toBe(true);
    expect(discountExceedsSubtotal('0.00', BASE)).toBe(false);
  });
});

describe('damageChargeOf (126 RN-3)', () => {
  const lines = [{ amount: '400.00' }, { amount: '250.00' }];

  it('caps the damages at the deductible with the coverage accepted', () => {
    expect(damageChargeOf({ lines, coverage: 'ACCEPTED', deductible: '500.00' })).toBe('500.00');
  });

  it('charges less than the deductible as is', () => {
    expect(
      damageChargeOf({ lines: [{ amount: '120.50' }], coverage: 'ACCEPTED', deductible: '500.00' }),
    ).toBe('120.50');
  });

  it('charges the full sum when the coverage is declined or undefined', () => {
    expect(damageChargeOf({ lines, coverage: 'DECLINED', deductible: '500.00' })).toBe('650.00');
    expect(damageChargeOf({ lines, coverage: 'UNDEFINED', deductible: '500.00' })).toBe('650.00');
  });

  it('is zero without lines', () => {
    expect(damageChargeOf({ lines: [], coverage: 'ACCEPTED', deductible: '500.00' })).toBe('0.00');
  });
});

describe('fuel and damages in the totals (126 RN-5)', () => {
  it('adds fuel and damages to the total and the balance', () => {
    expect(
      agreementTotals({
        ...BASE,
        fuelCharge: '25.00',
        damageCharge: '500.00',
        payments: [{ amount: '105.00' }],
      }),
    ).toMatchObject({ rental: '105.00', total: '630.00', paid: '105.00', balance: '525.00' });
  });

  it('raises the discount ceiling with fuel and damages', () => {
    expect(discountCeiling({ ...BASE, fuelCharge: '25.00', damageCharge: '500.00' })).toBe(
      '630.00',
    );
  });
});
