import type { RentalInspection } from '@elite/shared';

import {
  checkinBody,
  checkinExtraKm,
  checkoutBody,
  initialDraft,
  stepError,
  toggleZone,
  type InspectionContext,
} from './inspection-draft';

const PICKUP: RentalInspection = {
  odometerKm: 1000,
  fuelEighths: 8,
  damages: [{ zone: 'hood', description: 'Rayón' }],
  accessories: {},
  tires: {},
  battery: null,
  photoIds: [],
  notes: null,
};

const CONTEXT: InspectionContext = {
  vehicleOdometerKm: 1000,
  pickupInspection: PICKUP,
  pickupOdometerKm: 1000,
  deposit: '100.00',
  depositMethod: 'CASH',
  depositHeld: '100.00',
};

describe('borrador de la inspección (096)', () => {
  it('arranca con los accesorios presentes y, al recibir, con los daños de la salida', () => {
    const draft = initialDraft('checkin', CONTEXT, ['Antena'], '2026-10-12T10:00');

    expect(draft.accessories).toEqual({ Antena: true });
    expect(draft.damages).toEqual([{ zone: 'hood', description: 'Rayón' }]);
    expect(draft.depositReturnAmount).toBe('100.00');
  });

  it('tocar una zona la agrega o la quita', () => {
    const marked = toggleZone([], 'roof');
    expect(marked).toEqual([{ zone: 'roof', description: '' }]);
    expect(toggleZone(marked, 'roof')).toEqual([]);
  });

  it('km y combustible son obligatorios; al recibir, el km no baja del de salida', () => {
    const draft = initialDraft('checkin', CONTEXT, [], '2026-10-12T10:00');

    expect(
      stepError('km', 'checkin', { ...draft, odometerKm: '900', fuelEighths: 4 }, CONTEXT),
    ).toMatch(/menor/);
    expect(stepError('km', 'checkin', { ...draft, odometerKm: '1200' }, CONTEXT)).toMatch(
      /combustible/,
    );
    expect(
      stepError('km', 'checkin', { ...draft, odometerKm: '1200', fuelEighths: 4 }, CONTEXT),
    ).toBeNull();
  });

  it('la entrega arma el cuerpo del contrato con depósito y pago', () => {
    const draft = {
      ...initialDraft('checkout', CONTEXT, [], '2026-10-10T10:00'),
      fuelEighths: 8,
      paymentAmount: '50',
    };
    const body = checkoutBody(draft);

    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.value).toMatchObject({
        actualPickupAt: '2026-10-10T16:00:00.000Z',
        inspection: { odometerKm: 1000, fuelEighths: 8 },
        deposit: '100.00',
        payment: { amount: '50.00', method: 'CASH' },
      });
    }
  });

  it('cambiar los días al recibir pide nota; sin cambio no viajan', () => {
    const draft = {
      ...initialDraft('checkin', CONTEXT, [], '2026-10-12T10:00'),
      odometerKm: '1500',
      fuelEighths: 6,
    };

    expect(checkinBody({ ...draft, billableDays: '3' }, 2)).toEqual({
      ok: false,
      message: 'Si cambiás los días, escribí por qué.',
    });

    const same = checkinBody({ ...draft, billableDays: '2' }, 2);
    expect(same.ok).toBe(true);
    if (same.ok) expect(same.value.billableDays).toBeUndefined();
  });

  it('calcula los km extra con los libres por día', () => {
    const draft = { ...initialDraft('checkin', CONTEXT, [], ''), odometerKm: '1500' };
    const vehicle = { freeKmPerDay: 200, extraKmPrice: '0.25' };

    expect(checkinExtraKm(draft, CONTEXT, vehicle, 2)).toEqual({
      driven: 500,
      allowed: 400,
      extra: 100,
      charge: '25.00',
    });
    expect(checkinExtraKm({ ...draft, chargeExtraKm: false }, CONTEXT, vehicle, 2)?.charge).toBe(
      '0.00',
    );
  });
});
