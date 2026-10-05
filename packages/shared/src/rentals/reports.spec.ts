import {
  agreementIncome,
  breakEvenDays,
  civilPeriod,
  civilStartMs,
  fixedCost,
  lifetime,
  monthlyFixedCents,
  monthsFrac,
  profitability,
  profitabilityQuerySchema,
  prorate,
  VEHICLE_AVAILABILITY_LABELS,
  verdict,
  vehicleMonths,
  vehicleStart,
} from './reports';
import type { ReportAgreement, ReportVehicle } from './reports';

/** Un instante a la hora de El Salvador. */
const sv = (local: string): string => new Date(`${local}-06:00`).toISOString();

const VEHICLE: ReportVehicle = {
  id: 'v1',
  plate: 'P123456',
  make: 'Toyota',
  model: 'Yaris',
  year: 2022,
  category: 'SEDAN',
  status: 'ACTIVE',
  dailyRate: '35.00',
  odometerKm: 12000,
  purchasePrice: null,
  purchasedAt: null,
  financed: false,
  downPayment: null,
  installment: null,
  termMonths: null,
  financingStartedAt: null,
  installmentIncludesExtras: false,
  insuranceMonthly: null,
  gpsMonthly: null,
  otherFixedMonthly: null,
  insuranceExpiresAt: null,
  registrationExpiresAt: null,
};

function agreement(overrides: Partial<ReportAgreement>): ReportAgreement {
  return {
    id: 'a1',
    contractNumber: 733,
    vehicleId: 'v1',
    status: 'FINISHED',
    customerName: 'Ana López',
    plannedPickupAt: sv('2026-09-28T10:00:00'),
    plannedReturnAt: sv('2026-10-03T10:00:00'),
    actualPickupAt: sv('2026-09-28T10:00:00'),
    actualReturnAt: sv('2026-10-03T10:00:00'),
    pickupLocation: 'Oficina',
    returnLocation: 'Oficina',
    income: '300.00',
    balance: '0.00',
    ...overrides,
  };
}

const NOW = new Date(sv('2026-10-20T12:00:00'));

describe('monthsFrac', () => {
  it('del 15 al fin de octubre son 17/31 de mes', () => {
    expect(monthsFrac(civilStartMs('2026-10-15'), civilStartMs('2026-11-01'))).toBeCloseTo(
      17 / 31,
      10,
    );
  });

  it('dos meses enteros son 2, y un tramo al revés es 0', () => {
    expect(monthsFrac(civilStartMs('2026-10-01'), civilStartMs('2026-12-01'))).toBeCloseTo(2, 10);
    expect(monthsFrac(civilStartMs('2026-12-01'), civilStartMs('2026-10-01'))).toBe(0);
  });

  it('cruza meses de distinto largo', () => {
    // 14 de 28 días de febrero + 1 de marzo entero.
    expect(monthsFrac(civilStartMs('2026-02-15'), civilStartMs('2026-04-01'))).toBeCloseTo(
      14 / 28 + 1,
      10,
    );
  });
});

describe('prorate (RN-1)', () => {
  it('reparte por solapamiento', () => {
    const interval = {
      start: Date.parse(sv('2026-09-28T10:00:00')),
      end: Date.parse(sv('2026-10-03T10:00:00')),
    };

    // 58 h de 120 caen en octubre.
    expect(prorate('300.00', interval, civilPeriod('2026-10-01', '2026-10-31'))).toBeCloseTo(
      (30000 * 58) / 120,
      6,
    );
    expect(prorate('300.00', interval, civilPeriod('2026-11-01', '2026-11-30'))).toBe(0);
  });
});

describe('profitability', () => {
  it('una renta del 28 sep al 3 oct de 300 deja 300 × días en octubre / días totales', () => {
    const result = profitability(VEHICLE, [agreement({})], [], '2026-10-01', '2026-10-31', NOW);

    expect(result.income).toBe('145.00');
    expect(result.rentedDays).toBeCloseTo(2.4, 1);
    expect(result.agreements).toBe(1);

    const september = profitability(VEHICLE, [agreement({})], [], '2026-09-01', '2026-09-30', NOW);
    expect(september.income).toBe('155.00');
  });

  it('no cuenta canceladas ni reservas, y suma los gastos del periodo', () => {
    const result = profitability(
      VEHICLE,
      [agreement({ status: 'CANCELLED' }), agreement({ id: 'a2', status: 'RESERVED' })],
      [
        { incurredAt: '2026-10-05', amount: '40.00' },
        { incurredAt: '2026-11-01', amount: '99.00' },
      ],
      '2026-10-01',
      '2026-10-31',
      NOW,
    );

    expect(result.income).toBe('0.00');
    expect(result.expenses).toBe('40.00');
    expect(result.net).toBe('-40.00');
    expect(result.verdict).toBe('LOSS');
  });

  it('una renta en curso atrasada ocupa hasta ahora', () => {
    const late = agreement({
      status: 'IN_PROGRESS',
      plannedPickupAt: sv('2026-10-10T12:00:00'),
      actualPickupAt: sv('2026-10-10T12:00:00'),
      plannedReturnAt: sv('2026-10-15T12:00:00'),
      actualReturnAt: null,
      income: '100.00',
    });

    expect(profitability(VEHICLE, [late], [], '2026-10-01', '2026-10-31', NOW).rentedDays).toBe(10);
  });
});

describe('fixedCost (RN-3)', () => {
  it('seguro 40 + GPS 15 y cuota 350 desde la compra del 15: × 17/31', () => {
    const vehicle: ReportVehicle = {
      ...VEHICLE,
      insuranceMonthly: '40.00',
      gpsMonthly: '15.00',
      financed: true,
      installment: '350.00',
      termMonths: 24,
      purchasedAt: '2026-10-15',
    };
    const start = vehicleStart(vehicle, [], []);
    const result = fixedCost(vehicle, civilPeriod('2026-10-01', '2026-10-31'), start);

    expect(result.fixed).toBeCloseTo((5500 * 17) / 31, 6);
    expect(result.installment).toBeCloseTo((35000 * 17) / 31, 6);
  });

  it('la cuota no corre después del plazo', () => {
    const vehicle: ReportVehicle = {
      ...VEHICLE,
      financed: true,
      installment: '350.00',
      termMonths: 2,
      financingStartedAt: '2026-01-01',
    };
    const start = vehicleStart(vehicle, [], []);

    expect(
      fixedCost(vehicle, civilPeriod('2026-02-01', '2026-02-28'), start).installment,
    ).toBeCloseTo(35000, 6);
    expect(fixedCost(vehicle, civilPeriod('2026-03-01', '2026-03-31'), start).installment).toBe(0);
  });

  it('sin compra ni financiamiento, cuenta desde la primera renta', () => {
    expect(vehicleStart(VEHICLE, [agreement({})], [])).toBe(Date.parse(sv('2026-09-28T10:00:00')));
    expect(vehicleStart(VEHICLE, [], [])).toBeNull();
  });
});

describe('monthlyFixedCents (103, RN-2)', () => {
  const costs = { insuranceMonthly: '40.00', gpsMonthly: '15.00', otherFixedMonthly: '10.00' };

  it('suma seguro, GPS y otros fijos', () => {
    expect(monthlyFixedCents({ ...VEHICLE, ...costs })).toBe(6500);
  });

  it('financiado con la cuota que incluye seguro y GPS: solo cuentan los otros fijos', () => {
    expect(
      monthlyFixedCents({ ...VEHICLE, ...costs, financed: true, installmentIncludesExtras: true }),
    ).toBe(1000);
  });

  it('la bandera sin financiamiento no descuenta nada', () => {
    expect(monthlyFixedCents({ ...VEHICLE, ...costs, installmentIncludesExtras: true })).toBe(6500);
  });
});

describe('verdict', () => {
  it('tolerancia max(10, 3 % de los costos)', () => {
    expect(verdict(1001, 5000, 6001)).toBe('GAIN');
    expect(verdict(900, 5000, 5900)).toBe('EVEN');
    expect(verdict(-1001, 5000, 3999)).toBe('LOSS');
    // 3 % de 1.000 = 30 > 10.
    expect(verdict(2900, 100_000, 102_900)).toBe('EVEN');
    expect(verdict(3100, 100_000, 103_100)).toBe('GAIN');
    expect(verdict(0, 0, 0)).toBe('NONE');
  });
});

describe('lifetime', () => {
  it('financiado: prima 3.000 + 8 cuotas de 350', () => {
    const vehicle: ReportVehicle = {
      ...VEHICLE,
      financed: true,
      downPayment: '3000.00',
      installment: '350.00',
      termMonths: 36,
      financingStartedAt: '2026-02-01',
    };
    const result = lifetime(vehicle, [], [], new Date(sv('2026-09-20T12:00:00')));

    expect(result.installmentsPaid).toBe(8);
    expect(result.disbursed).toBe('5800.00');
    expect(result.pending).toBe(String(28 * 350) + '.00');
    expect(result.recovered).not.toBeNull();
  });

  it('al contado: lo desembolsado es el precio, y lo recuperado es operating / precio', () => {
    const vehicle: ReportVehicle = {
      ...VEHICLE,
      purchasePrice: '200.00',
      purchasedAt: '2026-09-01',
    };
    const result = lifetime(vehicle, [agreement({})], [], NOW);

    expect(result.disbursed).toBe('200.00');
    expect(result.recovered).toBe(1.5);
  });

  it('sin precio ni financiamiento: faltan datos', () => {
    expect(lifetime(VEHICLE, [], [], NOW).recovered).toBeNull();
  });
});

describe('breakEvenDays (RN-5)', () => {
  it('(fijos + cuota activa) / tarifa diaria', () => {
    const vehicle: ReportVehicle = {
      ...VEHICLE,
      insuranceMonthly: '40.00',
      gpsMonthly: '15.00',
      financed: true,
      installment: '350.00',
      financingStartedAt: '2026-01-01',
    };

    expect(breakEvenDays(vehicle, vehicleStart(vehicle, [], []), NOW)).toEqual({
      monthlyCost: '405.00',
      days: 11.6,
    });
    expect(breakEvenDays(VEHICLE, null, NOW)).toBeNull();
  });
});

describe('vehicleMonths', () => {
  it('12 filas; los meses que no empezaron van en cero', () => {
    const result = vehicleMonths(VEHICLE, [agreement({})], [], 2026, NOW);

    expect(result.rows).toHaveLength(12);
    expect(result.rows[8]).toMatchObject({ month: '2026-09', income: '155.00', future: false });
    expect(result.rows[9]).toMatchObject({ month: '2026-10', income: '145.00' });
    expect(result.rows[10]).toMatchObject({ month: '2026-11', future: true, verdict: 'NONE' });
    expect(result.total.income).toBe('300.00');
  });
});

describe('agreementIncome', () => {
  const base = {
    dailyRate: '100.00',
    cdwPerDay: '13.00',
    billableDays: 1,
    extraCharges: '0.00',
    extraKmCharge: '0.00',
    finesCharged: '0.00',
    discount: '0.00',
    payments: [{ amount: '50.00' }],
  };

  it('neto sin IVA y saldo', () => {
    expect(agreementIncome({ ...base, includesVat: true }, '13.00')).toEqual({
      income: '100.00',
      balance: '63.00',
    });
    expect(agreementIncome({ ...base, includesVat: true }, '0.00').income).toBe('113.00');
  });
});

describe('profitabilityQuerySchema', () => {
  it('rechaza un periodo al revés', () => {
    expect(
      profitabilityQuerySchema.safeParse({ from: '2026-10-31', to: '2026-10-01' }).success,
    ).toBe(false);
    expect(
      profitabilityQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-31' }).success,
    ).toBe(true);
  });
});

describe('VEHICLE_AVAILABILITY_LABELS (107)', () => {
  it('nombra el día con las cinco palabras del prototipo', () => {
    expect(VEHICLE_AVAILABILITY_LABELS).toEqual({
      FREE: 'Libre',
      RENTED: 'En renta',
      OVERDUE: 'Atrasado',
      RESERVED: 'Reservado',
      WORKSHOP: 'Taller',
    });
  });
});
