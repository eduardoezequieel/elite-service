import type { FleetVehicle } from '@elite/shared';

import {
  EMPTY_FLEET_VEHICLE_CREATE,
  createFleetVehicleFormSchema,
  expiryMark,
  financingProgress,
  fleetVehicleSectionDraft,
  fleetVehicleSectionFormSchema,
  fleetVehicleSectionValuesOf,
  rateFallback,
  upcomingExpiries,
} from './vehicle-form';

const VEHICLE: FleetVehicle = {
  id: 'v1',
  plate: 'P53DBC',
  make: 'Toyota',
  model: 'Yaris',
  year: 2022,
  color: 'Gris',
  category: 'SEDAN',
  status: 'ACTIVE',
  dailyRate: '35.00',
  weeklyRate: null,
  monthlyRate: null,
  freeKmPerDay: 200,
  extraKmPrice: '0.25',
  odometerKm: 48000,
  purchasePrice: '15000.00',
  purchasedAt: '2026-01-15',
  financed: true,
  downPayment: '3000.00',
  installment: '350.00',
  termMonths: 48,
  financingStartedAt: '2026-02-01',
  installmentIncludesExtras: false,
  insuranceMonthly: '40.00',
  gpsMonthly: '15.00',
  otherFixedMonthly: null,
  insurer: null,
  policyNumber: null,
  insuranceExpiresAt: null,
  registrationExpiresAt: null,
  notes: null,
  costsHidden: false,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

const VALUES = fleetVehicleSectionValuesOf(VEHICLE);

describe('alta corta (103)', () => {
  it('manda solo identificación, tarifa diaria y km al recibirlo', () => {
    const parsed = createFleetVehicleFormSchema.parse({
      ...EMPTY_FLEET_VEHICLE_CREATE,
      plate: 'p53 dbc',
      make: 'Toyota',
      model: 'Yaris',
      year: '2022',
      dailyRate: '35,50',
      odometerKm: '48000',
    });

    expect(parsed).toMatchObject({
      plate: 'P53DBC',
      year: 2022,
      dailyRate: '35.50',
      odometerKm: 48000,
      financed: false,
    });
    expect(parsed.weeklyRate).toBeUndefined();
    expect(parsed.purchasePrice).toBeUndefined();
  });

  it('sin km al recibirlo nace en 0; sin placa viaja como null', () => {
    const parsed = createFleetVehicleFormSchema.parse({
      ...EMPTY_FLEET_VEHICLE_CREATE,
      make: 'Kia',
      model: 'Rio',
      dailyRate: '30',
    });

    expect(parsed).toMatchObject({ odometerKm: 0, plate: null });
  });
});

describe('diálogo por tarjeta (103)', () => {
  it('cada tarjeta manda solo sus campos', () => {
    expect(Object.keys(fleetVehicleSectionFormSchema('identity').parse(VALUES)).sort()).toEqual(
      ['category', 'color', 'make', 'model', 'plate', 'year'].sort(),
    );
    expect(fleetVehicleSectionFormSchema('notes').parse({ ...VALUES, notes: '  ' })).toEqual({
      notes: null,
    });
    expect(
      fleetVehicleSectionFormSchema('documents').parse({
        ...VALUES,
        insurer: 'Seguros del Pacífico',
        insuranceExpiresAt: '05/03/2027',
      }),
    ).toEqual({
      insurer: 'Seguros del Pacífico',
      policyNumber: null,
      insuranceExpiresAt: '2027-03-05',
      registrationExpiresAt: null,
    });
  });

  it('ninguna tarjeta manda el kilometraje', () => {
    for (const card of ['identity', 'rates', 'purchase', 'fixed', 'documents', 'notes'] as const) {
      expect(fleetVehicleSectionDraft(card, VALUES)).not.toHaveProperty('odometerKm');
    }
  });

  it('km limitado apagado guarda km libres y km adicional en null', () => {
    expect(fleetVehicleSectionFormSchema('rates').parse({ ...VALUES, limitedKm: false })).toEqual({
      dailyRate: '35.00',
      weeklyRate: null,
      monthlyRate: null,
      freeKmPerDay: null,
      extraKmPrice: null,
    });
    expect(fleetVehicleSectionFormSchema('rates').parse(VALUES)).toMatchObject({
      freeKmPerDay: 200,
      extraKmPrice: '0.25',
    });
  });

  it('sin financiamiento, sus campos en null y la bandera en false (RN-2)', () => {
    expect(
      fleetVehicleSectionFormSchema('purchase').parse({
        ...VALUES,
        financed: false,
        installmentIncludesExtras: true,
      }),
    ).toMatchObject({
      financed: false,
      downPayment: null,
      installment: null,
      termMonths: null,
      financingStartedAt: null,
      installmentIncludesExtras: false,
    });
  });

  it('con la cuota que incluye seguro y GPS, costos fijos no los manda', () => {
    expect(
      fleetVehicleSectionDraft('fixed', { ...VALUES, installmentIncludesExtras: true }),
    ).toEqual({ otherFixedMonthly: null });
    expect(fleetVehicleSectionDraft('fixed', VALUES)).toEqual({
      insuranceMonthly: '40.00',
      gpsMonthly: '15.00',
      otherFixedMonthly: null,
    });
  });

  it('una fecha mal escrita marca su campo', () => {
    const result = fleetVehicleSectionFormSchema('purchase').safeParse({
      ...VALUES,
      purchasedAt: '31/02/2026',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['purchasedAt'],
      message: 'Escribí la fecha como dd/mm/aaaa.',
    });
  });
});

describe('rateFallback (RN-4, como cotiza rateForDays)', () => {
  it('7+ vacía cae a la diaria', () => {
    expect(rateFallback(VEHICLE, 'weeklyRate')).toBe('Igual que la diaria');
  });

  it('30+ vacía cae a la de 7+ si hay, si no a la diaria', () => {
    expect(rateFallback({ ...VEHICLE, weeklyRate: '30.00' }, 'monthlyRate')).toBe(
      'Igual que la de 7+',
    );
    expect(rateFallback(VEHICLE, 'monthlyRate')).toBe('Igual que la diaria');
  });

  it('una tarifa en 0 tampoco aplica; con monto propio no hay caída', () => {
    expect(rateFallback({ ...VEHICLE, weeklyRate: '0.00' }, 'weeklyRate')).toBe(
      'Igual que la diaria',
    );
    expect(rateFallback({ ...VEHICLE, monthlyRate: '25.00' }, 'monthlyRate')).toBeNull();
  });
});

describe('financingProgress', () => {
  it('cuota N de M, cuántas faltan y el mes de la última', () => {
    expect(financingProgress(VEHICLE, '2026-10-02')).toEqual({
      paid: 9,
      term: 48,
      left: 39,
      endsIn: 'ene 2030',
    });
  });

  it('sin plazo o sin inicio no hay avance; antes de empezar va en 0', () => {
    expect(financingProgress({ ...VEHICLE, termMonths: null }, '2026-10-02')).toBeNull();
    expect(financingProgress({ ...VEHICLE, financingStartedAt: null }, '2026-10-02')).toBeNull();
    expect(financingProgress(VEHICLE, '2025-12-01')?.paid).toBe(0);
  });
});

describe('expiryMark', () => {
  it('ámbar dentro del aviso, rojo si ya venció, nada si está lejos', () => {
    expect(expiryMark('2026-10-05', '2026-10-01', 7)).toEqual({
      tone: 'amber',
      label: 'Vence en 4 días',
    });
    expect(expiryMark('2026-09-30', '2026-10-01', 7)).toEqual({ tone: 'red', label: 'Vencido' });
    expect(expiryMark('2026-12-01', '2026-10-01', 7)).toBeNull();
    expect(expiryMark(null, '2026-10-01', 7)).toBeNull();
  });
});

describe('upcomingExpiries', () => {
  const vehicle: Pick<FleetVehicle, 'insuranceExpiresAt' | 'registrationExpiresAt'> = {
    insuranceExpiresAt: '2026-10-05',
    registrationExpiresAt: '2026-09-30',
  };

  it('marca lo vencido y lo que vence dentro del aviso', () => {
    expect(upcomingExpiries(vehicle, '2026-10-01', 7)).toEqual([
      { label: 'Seguro', date: '2026-10-05', overdue: false },
      { label: 'Tarjeta de circulación', date: '2026-09-30', overdue: true },
    ]);
  });

  it('lo lejano y lo sin fecha no avisan', () => {
    expect(
      upcomingExpiries(
        { insuranceExpiresAt: '2027-01-01', registrationExpiresAt: null },
        '2026-10-01',
        7,
      ),
    ).toEqual([]);
  });
});
