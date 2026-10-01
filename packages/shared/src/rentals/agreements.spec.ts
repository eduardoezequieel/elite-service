import {
  agreementsQuerySchema,
  calendarQuerySchema,
  checkinSchema,
  createAgreementSchema,
  depositHeldOf,
  derivedStatus,
  extraKmOf,
  intervalsClash,
  missingAccessories,
  newDamages,
  occupiedInterval,
  quoteText,
  rentalInspectionSchema,
  vehicleAvailability,
  waLink,
} from './agreements';

const HOUR = 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);

describe('derivedStatus (RN-1)', () => {
  const now = at('2026-10-12T12:00:00Z');

  it('marks an in-progress agreement past its planned return as LATE', () => {
    expect(
      derivedStatus({ status: 'IN_PROGRESS', plannedReturnAt: '2026-10-12T11:59:00Z' }, now),
    ).toBe('LATE');
  });

  it('keeps the stored status otherwise', () => {
    expect(
      derivedStatus({ status: 'IN_PROGRESS', plannedReturnAt: '2026-10-12T13:00:00Z' }, now),
    ).toBe('IN_PROGRESS');
    expect(
      derivedStatus({ status: 'RESERVED', plannedReturnAt: '2026-10-01T00:00:00Z' }, now),
    ).toBe('RESERVED');
  });
});

describe('occupiedInterval and intervalsClash (RN-2)', () => {
  const reserved = {
    status: 'RESERVED' as const,
    plannedPickupAt: '2026-10-10T10:00:00Z',
    plannedReturnAt: '2026-10-12T10:00:00Z',
    actualPickupAt: null,
  };
  const now = at('2026-10-01T00:00:00Z');

  it('clashes within the buffer and frees right at the buffer', () => {
    const busy = occupiedInterval(reserved, now);

    expect(
      intervalsClash(
        busy,
        { start: at('2026-10-12T10:30:00Z'), end: at('2026-10-14T10:00:00Z') },
        HOUR,
      ),
    ).toBe(true);
    expect(
      intervalsClash(
        busy,
        { start: at('2026-10-12T11:00:00Z'), end: at('2026-10-14T10:00:00Z') },
        HOUR,
      ),
    ).toBe(false);
  });

  it('applies the buffer before the pickup too', () => {
    const busy = occupiedInterval(reserved, now);

    expect(
      intervalsClash(
        busy,
        { start: at('2026-10-08T10:00:00Z'), end: at('2026-10-10T09:30:00Z') },
        HOUR,
      ),
    ).toBe(true);
    expect(
      intervalsClash(
        busy,
        { start: at('2026-10-08T10:00:00Z'), end: at('2026-10-10T09:00:00Z') },
        HOUR,
      ),
    ).toBe(false);
  });

  it('stretches a late agreement until now and starts at the real pickup', () => {
    const interval = occupiedInterval(
      {
        status: 'IN_PROGRESS',
        plannedPickupAt: '2026-10-10T10:00:00Z',
        actualPickupAt: '2026-10-10T08:00:00Z',
        plannedReturnAt: '2026-10-12T10:00:00Z',
      },
      at('2026-10-13T09:00:00Z'),
    );

    expect(interval.start.toISOString()).toBe('2026-10-10T08:00:00.000Z');
    expect(interval.end.toISOString()).toBe('2026-10-13T09:00:00.000Z');
  });

  it('ends a finished agreement at its real return', () => {
    const interval = occupiedInterval(
      {
        status: 'FINISHED',
        plannedPickupAt: '2026-10-10T10:00:00Z',
        actualPickupAt: '2026-10-10T10:00:00Z',
        plannedReturnAt: '2026-10-12T10:00:00Z',
        actualReturnAt: '2026-10-11T18:00:00Z',
      },
      now,
    );

    expect(interval.end.toISOString()).toBe('2026-10-11T18:00:00.000Z');
  });
});

describe('vehicleAvailability', () => {
  const now = at('2026-10-11T12:00:00Z');
  const range = { start: at('2026-10-13T10:00:00Z'), end: at('2026-10-15T10:00:00Z') };
  const inProgress = {
    status: 'IN_PROGRESS' as const,
    plannedPickupAt: '2026-10-10T10:00:00Z',
    actualPickupAt: '2026-10-10T10:00:00Z',
    plannedReturnAt: '2026-10-12T10:00:00Z',
  };

  it('is FREE without occupying agreements', () => {
    expect(vehicleAvailability([], range, HOUR, now).availability).toBe('FREE');
  });

  it('is FREE_IF_RETURNED when only a running agreement must come back before', () => {
    const result = vehicleAvailability([inProgress], range, HOUR, now);

    expect(result.availability).toBe('FREE_IF_RETURNED');
    expect(result.blocking).toBe(inProgress);
  });

  it('is BUSY when the running agreement returns inside the range or a reservation clashes', () => {
    expect(
      vehicleAvailability(
        [{ ...inProgress, plannedReturnAt: '2026-10-13T09:30:00Z' }],
        range,
        HOUR,
        now,
      ).availability,
    ).toBe('BUSY');
    expect(
      vehicleAvailability(
        [
          inProgress,
          {
            status: 'RESERVED',
            plannedPickupAt: '2026-10-14T10:00:00Z',
            actualPickupAt: null,
            plannedReturnAt: '2026-10-16T10:00:00Z',
          },
        ],
        range,
        HOUR,
        now,
      ).availability,
    ).toBe('BUSY');
  });

  it('ignores finished and cancelled agreements', () => {
    expect(
      vehicleAvailability(
        [{ ...inProgress, status: 'CANCELLED', plannedReturnAt: '2026-10-14T00:00:00Z' }],
        range,
        HOUR,
        now,
      ).availability,
    ).toBe('FREE');
  });
});

describe('extraKmOf', () => {
  it('charges the km over freeKmPerDay × billableDays', () => {
    expect(
      extraKmOf({
        pickupKm: 10_000,
        returnKm: 10_750,
        freeKmPerDay: 200,
        extraKmPrice: '0.25',
        billableDays: 3,
      }),
    ).toEqual({ driven: 750, allowed: 600, extra: 150, charge: '37.50' });
  });

  it('charges nothing with free mileage', () => {
    expect(
      extraKmOf({
        pickupKm: 0,
        returnKm: 5000,
        freeKmPerDay: null,
        extraKmPrice: '0.25',
        billableDays: 1,
      }).charge,
    ).toBe('0.00');
  });
});

describe('depositHeldOf', () => {
  it('subtracts what was returned and is zero once transferred', () => {
    expect(
      depositHeldOf({
        deposit: '200.00',
        depositReturnedAmount: '50.00',
        depositTransferredToId: null,
      }),
    ).toBe('150.00');
    expect(
      depositHeldOf({
        deposit: '200.00',
        depositReturnedAmount: null,
        depositTransferredToId: 'x',
      }),
    ).toBe('0.00');
  });
});

describe('waLink (RN-9)', () => {
  it('prefixes 503 to an 8-digit local number', () => {
    expect(waLink('7742-1900', 'Hola')).toBe('https://wa.me/50377421900?text=Hola');
  });

  it('keeps a number that already has its country code', () => {
    expect(waLink('+503 7742 1900', 'a b')).toBe('https://wa.me/50377421900?text=a%20b');
  });

  it('returns null without a usable phone', () => {
    expect(waLink(null, 'x')).toBeNull();
    expect(waLink('123', 'x')).toBeNull();
  });
});

describe('quoteText', () => {
  it('lists the car, the dates and the total', () => {
    const text = quoteText({
      vehicleName: 'Toyota Yaris P53DBC',
      from: '2026-10-12T16:00:00Z',
      to: '2026-10-14T16:00:00Z',
      billableDays: 2,
      dailyRate: '35.00',
      total: '70.00',
    });

    expect(text).toContain('Toyota Yaris P53DBC');
    expect(text).toContain('2 días × $35.00 = $70.00');
  });
});

describe('newDamages (RN-8)', () => {
  it('returns only the zones that were clean at pickup', () => {
    const pickup = { damages: [{ zone: 'hood' as const, description: 'rayón' }] };
    const returned = {
      damages: [
        { zone: 'hood' as const, description: 'rayón' },
        { zone: 'rear_bumper' as const, description: 'golpe' },
      ],
    };

    expect(newDamages(pickup, returned)).toEqual([{ zone: 'rear_bumper', description: 'golpe' }]);
    expect(newDamages(null, returned)).toHaveLength(2);
  });

  it('lists missing accessories', () => {
    expect(missingAccessories({ accessories: { Antena: true, Triángulos: false } })).toEqual([
      'Triángulos',
    ]);
  });
});

describe('schemas', () => {
  const base = {
    customerId: '6f1c2d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    vehicleId: '7f1c2d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    plannedPickupAt: '2026-10-10T10:00:00.000Z',
    plannedReturnAt: '2026-10-12T10:00:00.000Z',
  };

  it('fills the defaults of a reservation', () => {
    const parsed = createAgreementSchema.parse(base);

    expect(parsed).toMatchObject({
      pickupLocation: 'Oficina',
      coverage: 'UNDEFINED',
      includesVat: true,
      deposit: '0.00',
      checkoutNow: false,
    });
  });

  it('rejects a return before the pickup and checkoutNow without inspection', () => {
    expect(
      createAgreementSchema.safeParse({ ...base, plannedReturnAt: base.plannedPickupAt }).success,
    ).toBe(false);
    expect(createAgreementSchema.safeParse({ ...base, checkoutNow: true }).success).toBe(false);
  });

  it('keeps only the last 4 digits of the card (RN-6)', () => {
    expect(
      createAgreementSchema.safeParse({ ...base, cardLast4: '4111111111111111' }).success,
    ).toBe(false);
    expect(createAgreementSchema.safeParse({ ...base, cardLast4: '1111' }).success).toBe(true);
  });

  it('requires km and fuel in the inspection (RN-8)', () => {
    expect(rentalInspectionSchema.safeParse({ odometerKm: 100 }).success).toBe(false);
    expect(rentalInspectionSchema.parse({ odometerKm: 100, fuelEighths: 8 })).toMatchObject({
      damages: [],
      accessories: {},
      photoIds: [],
    });
    expect(rentalInspectionSchema.safeParse({ odometerKm: 1, fuelEighths: 9 }).success).toBe(false);
  });

  it('charges extra km by default at checkin', () => {
    expect(
      checkinSchema.parse({
        actualReturnAt: '2026-10-12T10:00:00Z',
        inspection: { odometerKm: 1, fuelEighths: 4 },
      }).chargeExtraKm,
    ).toBe(true);
  });

  it('reads a comma separated status list', () => {
    expect(agreementsQuerySchema.parse({ status: 'RESERVED,IN_PROGRESS' }).status).toEqual([
      'RESERVED',
      'IN_PROGRESS',
    ]);
    expect(agreementsQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
  });

  it('caps the calendar range', () => {
    expect(calendarQuerySchema.safeParse({ from: '2026-10-01', to: '2026-10-28' }).success).toBe(
      true,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-10-01', to: '2026-12-28' }).success).toBe(
      false,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-10-05', to: '2026-10-01' }).success).toBe(
      false,
    );
  });
});
