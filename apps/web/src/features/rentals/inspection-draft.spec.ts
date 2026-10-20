import type { RentalInspection } from '@elite/shared';

import {
  addDamageLine,
  checkinBody,
  checkinPreview,
  checkinExtraKm,
  checkoutBody,
  clearInspectionDraft,
  initialDraft,
  inspectionDraftKey,
  readInspectionDraft,
  removeDamageLine,
  returnChargesOf,
  stepError,
  stepSummary,
  toggleDamageZone,
  toggleZone,
  writeInspectionDraft,
  type InspectionContext,
  type KeyValueStore,
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

  it('la entrega arma el cuerpo con depósito y sin pago embebido', () => {
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
      });
      expect(body.value.payment).toBeUndefined();
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

  it('guarda el borrador a medias y tira un JSON roto', () => {
    let stored: string | null = null;
    const store: KeyValueStore = {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
      removeItem: () => {
        stored = null;
      },
    };
    const key = inspectionDraftKey('renta-1', 'checkout');
    const draft = initialDraft('checkout', CONTEXT, [], '2026-10-10T11:00');

    expect(readInspectionDraft(store, key)).toBeNull();
    writeInspectionDraft(store, key, draft);
    expect(readInspectionDraft(store, key)?.odometerKm).toBe(draft.odometerKm);
    store.setItem(key, '{');
    expect(readInspectionDraft(store, key)).toBeNull();
    writeInspectionDraft(store, key, draft);
    clearInspectionDraft(store, key);
    expect(readInspectionDraft(store, key)).toBeNull();
  });

  describe('combustible y daños al recibir (126)', () => {
    const base = () => ({
      ...initialDraft('checkin', CONTEXT, [], '2026-10-12T10:00'),
      odometerKm: '1500',
      fuelEighths: 4,
    });

    it('arranca sin combustible ni líneas', () => {
      expect(base()).toMatchObject({ fuelAmount: '', damageLines: [] });
    });

    it('tocar una zona sana agrega su línea y la marca; otra vez quita las dos', () => {
      const draft = base();
      const marked = toggleDamageZone(draft, 'roof', PICKUP);

      expect(marked.damageLines).toEqual([
        { id: expect.any(String), zone: 'roof', part: 'Techo', amount: '' },
      ]);
      expect(marked.damages.map((damage) => damage.zone)).toEqual(['hood', 'roof']);

      const cleared = toggleDamageZone({ ...draft, ...marked }, 'roof', PICKUP);
      expect(cleared.damageLines).toEqual([]);
      expect(cleared.damages.map((damage) => damage.zone)).toEqual(['hood']);
    });

    it('una zona dañada en la salida no se marca', () => {
      const draft = base();

      expect(toggleDamageZone(draft, 'hood', PICKUP)).toEqual({
        damages: draft.damages,
        damageLines: [],
      });
    });

    it('«+ Daño» agrega una línea libre y quitar una con zona la desmarca', () => {
      const draft = base();
      const withZone = { ...draft, ...toggleDamageZone(draft, 'trunk', PICKUP) };
      const lines = addDamageLine(withZone.damageLines);

      expect(lines[1]).toMatchObject({ zone: null, part: '', amount: '' });
      expect(new Set(lines.map((line) => line.id)).size).toBe(2);

      const zoneLine = lines[0]!;
      const removed = removeDamageLine({ ...withZone, damageLines: lines }, zoneLine.id);
      expect(removed.damageLines).toHaveLength(1);
      expect(removed.damages.map((damage) => damage.zone)).toEqual(['hood']);
    });

    it('la vista previa topa los daños al deducible solo con la cobertura aceptada', () => {
      const draft = {
        ...base(),
        fuelAmount: '25',
        damageLines: [
          { id: 'a', zone: 'roof' as const, part: 'Techo', amount: '400' },
          { id: 'b', zone: null, part: 'Tapicería', amount: '250,00' },
        ],
      };

      expect(returnChargesOf(draft, { coverage: 'ACCEPTED', deductible: '500.00' })).toMatchObject({
        fuelCharge: '25.00',
        damagesSum: '650.00',
        damageCharge: '500.00',
      });
      expect(
        returnChargesOf(draft, { coverage: 'DECLINED', deductible: '500.00' }).damageCharge,
      ).toBe('650.00');
    });

    it('la cuenta previa suma días, km extra, combustible y daños topados; la garantía no resta', () => {
      const draft = {
        ...base(),
        fuelAmount: '25',
        damageLines: [{ id: 'a', zone: 'roof' as const, part: 'Techo', amount: '650' }],
      };
      const preview = checkinPreview(
        {
          dailyRate: '35.00',
          cdwPerDay: '0.00',
          extraCharges: '0.00',
          extraChargesNote: null,
          discount: '0.00',
          fines: [],
          payments: [
            {
              id: 'p',
              agreementId: 'r',
              amount: '70.00',
              method: 'CASH',
              reference: null,
              paidAt: '2026-10-10T16:00:00.000Z',
              note: null,
              receivedByUserId: 'u',
              receivedByName: 'Caja',
              voidedAt: null,
              voidReason: null,
              voidedByUserId: null,
              voidedByName: null,
              cashSessionId: null,
              createdAt: '2026-10-10T16:00:00.000Z',
            },
          ],
          coverage: 'ACCEPTED',
          deductible: '500.00',
        },
        draft,
        2,
        '10.00',
      );

      expect(preview.totals).toEqual({
        rental: '70.00',
        total: '605.00',
        paid: '70.00',
        balance: '535.00',
      });
      expect(preview.account).toMatchObject({ fuelCharge: '25.00', damageCharge: '500.00' });
    });

    it('el cuerpo lleva combustible y líneas; descarta la libre vacía y rechaza un monto negativo', () => {
      const draft = {
        ...base(),
        fuelAmount: '25',
        damageLines: [
          { id: 'a', zone: 'roof' as const, part: 'Techo', amount: '' },
          { id: 'b', zone: null, part: '', amount: '' },
          { id: 'c', zone: null, part: 'Tapicería', amount: '250' },
        ],
      };
      const body = checkinBody(draft, 2);

      expect(body.ok).toBe(true);
      if (body.ok) {
        expect(body.value.fuelCharge).toBe('25.00');
        expect(body.value.damageLines).toEqual([
          { zone: 'roof', part: 'Techo', amount: '0.00' },
          { zone: null, part: 'Tapicería', amount: '250.00' },
        ]);
      }

      const negative = checkinBody(
        { ...draft, damageLines: [{ id: 'x', zone: null, part: 'Capó', amount: '-5' }] },
        2,
      );
      expect(negative.ok).toBe(false);
    });

    it('un borrador viejo sin los campos nuevos se lee con valores vacíos', () => {
      const store: KeyValueStore = {
        getItem: () => JSON.stringify({ at: '2026-10-12T10:00', odometerKm: '1500' }),
        setItem: () => undefined,
        removeItem: () => undefined,
      };

      expect(readInspectionDraft(store, 'k')).toMatchObject({ fuelAmount: '', damageLines: [] });
    });
  });

  describe('resumen de cada pestaña', () => {
    it('kilometraje: km y combustible, o nada si está vacío', () => {
      const draft = initialDraft('checkout', CONTEXT, [], '2026-10-12T10:00');

      expect(stepSummary('km', 'checkout', { ...draft, odometerKm: '', fuelEighths: null })).toBe(
        null,
      );
      expect(stepSummary('km', 'checkout', { ...draft, odometerKm: '48000', fuelEighths: 4 })).toBe(
        '48,000 · ½',
      );
    });

    it('golpes: cuenta las zonas al entregar y las líneas al recibir, y lo que falta', () => {
      const out = initialDraft('checkout', CONTEXT, ['Antena', 'Placas'], '2026-10-12T10:00');
      const marked = {
        ...out,
        damages: toggleZone(toggleZone([], 'roof'), 'hood'),
        accessories: { Antena: false, Placas: true },
      };

      expect(stepSummary('damages', 'checkout', out)).toBe('Sin golpes');
      expect(stepSummary('damages', 'checkout', marked)).toBe('2 golpes · 1 falta');

      const back = initialDraft('checkin', CONTEXT, [], '2026-10-12T10:00');
      expect(stepSummary('damages', 'checkin', back)).toBe('Sin golpes');
      expect(stepSummary('damages', 'checkin', { ...back, damageLines: addDamageLine([]) })).toBe(
        '1 golpe',
      );
    });
  });
});
