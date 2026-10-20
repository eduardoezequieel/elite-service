import type { RentalAgreementVehicle, RentalInspection, RentalPayment } from '@elite/shared';

import {
  initialSwapDraft,
  pickSwapVehicle,
  swapBody,
  swapPreview,
  swapRate,
  swapReasonText,
  swapStepError,
  swapWindow,
  type SwapDraft,
  type SwapSource,
} from './swap-draft';

const VEHICLE: RentalAgreementVehicle = {
  id: '7f1c2d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  plate: 'P111',
  make: 'Toyota',
  model: 'Yaris',
  year: 2022,
  color: null,
  category: 'SEDAN',
  status: 'ACTIVE',
  odometerKm: 10_000,
  dailyRate: '40.00',
  weeklyRate: null,
  monthlyRate: null,
  freeKmPerDay: null,
  extraKmPrice: null,
};

const NEW_CAR: RentalAgreementVehicle = {
  ...VEHICLE,
  id: '8f1c2d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  plate: 'P222',
  odometerKm: 5_000,
  dailyRate: '45.00',
  weeklyRate: '38.00',
};

const PICKUP: RentalInspection = {
  odometerKm: 10_000,
  fuelEighths: 8,
  damages: [{ zone: 'roof', description: '' }],
  accessories: {},
  tires: {},
  battery: null,
  photoIds: [],
  notes: null,
};

function payment(amount: string): RentalPayment {
  return { amount, voidedAt: null } as RentalPayment;
}

/** 10 días a $40: sale el 10 a las 10:00 y vuelve el 20. */
function agreement(overrides: Partial<SwapSource> = {}): SwapSource {
  return {
    contractNumber: 733,
    vehicleId: VEHICLE.id,
    vehicle: VEHICLE,
    plannedPickupAt: '2026-10-10T16:00:00.000Z',
    actualPickupAt: '2026-10-10T16:00:00.000Z',
    plannedReturnAt: '2026-10-20T16:00:00.000Z',
    pickupInspection: PICKUP,
    pickupOdometerKm: 10_000,
    deposit: '200.00',
    depositMethod: 'CASH',
    depositHeld: '200.00',
    dailyRate: '40.00',
    cdwPerDay: '0.00',
    extraCharges: '0.00',
    extraChargesNote: null,
    discount: '0.00',
    fines: [],
    payments: [payment('400.00')],
    coverage: 'DECLINED',
    deductible: '500.00',
    ...overrides,
  };
}

/** El día 4, con el carro recibido, el nuevo elegido y los dos km. */
function filled(source: SwapSource = agreement()): SwapDraft {
  const draft = pickSwapVehicle(initialSwapDraft(source, [], '2026-10-14T10:00'), NEW_CAR, []);

  return {
    ...draft,
    why: 'Falla',
    detail: ' frenos ',
    returned: { ...draft.returned, odometerKm: '10300', fuelEighths: 4 },
    pickup: { ...draft.pickup, fuelEighths: 8 },
  };
}

describe('cambiar de carro (127 RN-5)', () => {
  it('cuenta los días de las dos rentas como el API', () => {
    expect(swapWindow(agreement(), '2026-10-14T10:00', 1)).toEqual({
      at: '2026-10-14T16:00:00.000Z',
      until: '2026-10-20T16:00:00.000Z',
      closedDays: 4,
      openedDays: 6,
    });
    // Atrasada: la nueva arranca con un día.
    expect(swapWindow(agreement(), '2026-10-22T10:00', 1)).toMatchObject({
      until: '2026-10-23T16:00:00.000Z',
      openedDays: 1,
    });
  });

  it('al elegir el carro el km arranca en el suyo', () => {
    expect(filled().pickup.odometerKm).toBe('5000');
    expect(swapReasonText(filled())).toBe('Falla · frenos');
  });

  it('la tarifa por defecto es la misma; «Del carro» usa su tramo; «Otra» la escrita (RN-6)', () => {
    const draft = filled();

    expect(swapRate(draft, agreement(), 6)).toBe('40.00');
    expect(swapRate({ ...draft, rateMode: 'vehicle' }, agreement(), 6)).toBe('45.00');
    expect(swapRate({ ...draft, rateMode: 'vehicle' }, agreement(), 7)).toBe('38.00');
    expect(swapRate({ ...draft, rateMode: 'other', otherRate: '33' }, agreement(), 6)).toBe(
      '33.00',
    );
    expect(swapRate({ ...draft, rateMode: 'other', otherRate: '' }, agreement(), 6)).toBeNull();
  });

  it('pide fecha posterior, km ≥ salida, combustible y motivo antes de entregar', () => {
    const draft = filled();

    expect(swapStepError('return', draft, agreement(), 1)).toBeNull();
    expect(
      swapStepError(
        'return',
        { ...draft, returned: { ...draft.returned, at: '2026-10-09T10:00' } },
        agreement(),
        1,
      ),
    ).toContain('después de la salida');
    expect(
      swapStepError(
        'return',
        { ...draft, returned: { ...draft.returned, odometerKm: '9999' } },
        agreement(),
        1,
      ),
    ).toContain('10000 km');
    expect(
      swapStepError('return', { ...draft, why: '', detail: '' }, agreement(), 1),
    ).not.toBeNull();
    expect(swapStepError('pickup', { ...draft, vehicle: null }, agreement(), 1)).toBe(
      'Elija el carro nuevo.',
    );
    expect(swapStepError('pickup', draft, agreement(), 1)).toBeNull();
  });

  it('pagó $400 por 10 días y cambia el día 4: $160 quedan en la vieja y $240 pasan', () => {
    const preview = swapPreview(agreement(), filled(), 1);

    expect(preview.surplus).toBe('240.00');
    expect(preview.closed.totals).toMatchObject({
      total: '160.00',
      paid: '160.00',
      balance: '0.00',
    });
    expect(preview.opened).toMatchObject({ total: '240.00', paid: '240.00', balance: '0.00' });
  });

  it('si en la vieja queda deuda, se queda en ella', () => {
    const source = agreement({ payments: [payment('100.00')] });
    const preview = swapPreview(source, filled(source), 1);

    expect(preview.surplus).toBe('0.00');
    expect(preview.closed.totals).toMatchObject({ paid: '100.00', balance: '60.00' });
    expect(preview.opened).toMatchObject({ paid: '0.00', balance: '240.00' });
  });

  it('el combustible y los daños entran a la vieja con el tope de la 126', () => {
    const source = agreement({ coverage: 'ACCEPTED', deductible: '100.00', payments: [] });
    const draft = filled(source);
    const preview = swapPreview(
      source,
      {
        ...draft,
        returned: {
          ...draft.returned,
          fuelAmount: '15',
          damageLines: [{ id: 'line-1', zone: 'hood', part: 'Capó', amount: '250' }],
        },
      },
      1,
    );

    expect(preview.closed.charges).toMatchObject({ fuelCharge: '15.00', damageCharge: '100.00' });
    expect(preview.closed.totals.total).toBe('275.00');
  });

  it('arma el cuerpo con las dos inspecciones y la tarifa', () => {
    const body = swapBody(filled(), agreement(), 1);

    expect(body).toMatchObject({
      ok: true,
      value: {
        at: '2026-10-14T16:00:00.000Z',
        newVehicleId: NEW_CAR.id,
        dailyRate: '40.00',
        reason: 'Falla · frenos',
        chargeExtraKm: true,
        fuelCharge: '0.00',
        damageLines: [],
        returnInspection: { odometerKm: 10_300, fuelEighths: 4 },
        pickupInspection: { odometerKm: 5_000, fuelEighths: 8 },
      },
    });
  });
});
