import { agreementTotals } from '@elite/shared';

import {
  extendBody,
  extendPayment,
  extendPreview,
  initialExtendDraft,
  quickReturn,
  type ExtendSource,
} from './extend-draft';

function source(overrides: Partial<ExtendSource> = {}): ExtendSource {
  const base = {
    plannedPickupAt: '2026-10-10T16:00:00.000Z',
    actualPickupAt: '2026-10-10T16:00:00.000Z',
    // 5 días a $35.
    plannedReturnAt: '2026-10-15T16:00:00.000Z',
    dailyRate: '35.00',
    cdwPerDay: '0.00',
    billableDays: 5,
    extraCharges: '0.00',
    extraKmCharge: '0.00',
    fuelCharge: '0.00',
    damageCharge: '0.00',
    discount: '0.00',
    fines: [],
    payments: [],
    ...overrides,
  };

  return {
    ...base,
    totals: agreementTotals({ ...base, finesCharged: '0.00' }),
  } as ExtendSource;
}

describe('extender (127 RN-2)', () => {
  it('arranca un día después, con la tarifa pactada y «Cobrar ahora» marcado', () => {
    expect(initialExtendDraft(source())).toEqual({
      returnAt: '2026-10-16T10:00',
      dailyRate: '35.00',
      note: '',
      charge: true,
      payAmount: '',
      payTouched: false,
      method: 'CASH',
    });
    expect(quickReturn(source(), 7)).toBe('2026-10-22T10:00');
  });

  it('a 9 días deja la tarifa y sugiere cobrar lo agregado', () => {
    const agreement = source();
    const draft = { ...initialExtendDraft(agreement), returnAt: quickReturn(agreement, 4) };
    const preview = extendPreview(agreement, draft, 1);

    expect(preview).toMatchObject({
      days: 9,
      returnError: null,
      rateError: null,
      payError: null,
      addedCents: 14_000,
      payCents: 14_000,
      suggestedPay: '140.00',
      balanceCents: 17_500,
    });
    expect(preview.after.total).toBe('315.00');

    const body = extendBody(draft);
    expect(body).toEqual({
      ok: true,
      value: { newReturnAt: '2026-10-19T16:00:00.000Z', dailyRate: '35.00', note: null },
    });
    expect(extendPayment(draft, preview)).toEqual({
      ok: true,
      value: { amount: '140.00', method: 'CASH' },
    });
  });

  it('sin «Cobrar ahora» solo sube el saldo', () => {
    const agreement = source();
    const draft = { ...initialExtendDraft(agreement), charge: false };
    const preview = extendPreview(agreement, draft, 1);

    expect(preview).toMatchObject({ payCents: 0, balanceCents: 21_000 });
    expect(extendPayment(draft, preview)).toBeNull();
  });

  it('la sugerencia no pasa del saldo si ya se pagó de más', () => {
    const agreement = source({
      payments: [{ amount: '200.00', voidedAt: null } as ExtendSource['payments'][number]],
    });
    const draft = initialExtendDraft(agreement);
    const preview = extendPreview(agreement, draft, 1);

    // Total 210, pagado 200: agrega 35 pero solo debe 10.
    expect(preview).toMatchObject({ addedCents: 3_500, suggestedPay: '10.00', payCents: 1_000 });
  });

  it('marca el regreso que no avanza, la tarifa vacía y el monto que pasa del saldo', () => {
    const agreement = source();
    const draft = initialExtendDraft(agreement);

    expect(extendPreview(agreement, { ...draft, returnAt: '2026-10-15T10:00' }, 1)).toMatchObject({
      days: null,
      returnError: expect.any(String),
      addedCents: 0,
    });
    expect(extendPreview(agreement, { ...draft, dailyRate: '' }, 1).rateError).not.toBeNull();
    expect(
      extendPreview(agreement, { ...draft, payTouched: true, payAmount: '999' }, 1).payError,
    ).toContain('$210.00');
    expect(
      extendPreview(agreement, { ...draft, payTouched: true, payAmount: 'x' }, 1).payError,
    ).not.toBeNull();
  });

  it('una tarifa escrita cambia lo agregado', () => {
    const agreement = source();
    const draft = { ...initialExtendDraft(agreement), dailyRate: '30' };

    // 6 × $30 − 5 × $35.
    expect(extendPreview(agreement, draft, 1).addedCents).toBe(500);
  });
});
