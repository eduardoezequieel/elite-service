import { agreementTotals } from '@elite/shared';

import {
  EMPTY_AGREEMENT_FORM,
  agreementFormDefaults,
  agreementUpdateDraft,
  createAgreementFormSchema,
  deliversNow,
  writtenRentalTotal,
} from './agreement-form';

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const VEHICLE = '22222222-2222-4222-8222-222222222222';

describe('formulario de renta (096)', () => {
  it('arma el alta con instantes, montos y sin los vacíos que pone el API', () => {
    const parsed = createAgreementFormSchema.parse({
      ...EMPTY_AGREEMENT_FORM,
      customerId: CUSTOMER,
      vehicleId: VEHICLE,
      plannedPickupAt: '2026-10-10T10:00',
      plannedReturnAt: '2026-10-12T10:00',
      deposit: '100',
      cardLast4: '4242',
      authorizationDate: '05/10/2026',
    });

    expect(parsed).toMatchObject({
      plannedPickupAt: '2026-10-10T16:00:00.000Z',
      plannedReturnAt: '2026-10-12T16:00:00.000Z',
      deposit: '100.00',
      extraCharges: '0.00',
      cardLast4: '4242',
      authorizationDate: '2026-10-05',
      additionalDriver: null,
      checkoutNow: false,
    });
    expect(parsed.dailyRate).toBeUndefined();
    expect(parsed.billableDays).toBeUndefined();
  });

  it('rechaza un regreso antes de la salida y una tarjeta que no son 4 dígitos', () => {
    const result = createAgreementFormSchema.safeParse({
      ...EMPTY_AGREEMENT_FORM,
      customerId: CUSTOMER,
      vehicleId: VEHICLE,
      plannedPickupAt: '2026-10-12T10:00',
      plannedReturnAt: '2026-10-10T10:00',
      cardLast4: '4242424242424242',
    });

    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['cardLast4']));
  });

  it('la URL prellena carro y salida; el regreso cae un día después', () => {
    expect(agreementFormDefaults({ vehicleId: VEHICLE, from: '2026-10-10' })).toMatchObject({
      vehicleId: VEHICLE,
      plannedPickupAt: '2026-10-10T11:00',
      plannedReturnAt: '2026-10-11T11:00',
    });
  });

  it('sin fechas, sale hoy a las 11:00 y regresa mañana', () => {
    expect(agreementFormDefaults({}, '2026-10-08')).toMatchObject({
      plannedPickupAt: '2026-10-08T11:00',
      plannedReturnAt: '2026-10-09T11:00',
    });
  });

  it('entregar ahora solo si la salida es hoy', () => {
    expect(deliversNow('2026-10-08T11:00', '2026-10-08')).toBe(true);
    expect(deliversNow('2026-10-09T11:00', '2026-10-08')).toBe(false);
  });

  it('el total escrito usa el total de agreementTotals', () => {
    const totals = agreementTotals({
      dailyRate: '35.00',
      cdwPerDay: '0.00',
      billableDays: 3,
      extraCharges: '0.00',
      extraKmCharge: '0.00',
      finesCharged: '0.00',
      discount: '0.00',
      payments: [],
    });

    expect(writtenRentalTotal('35.00', 3, totals.total)).toBe('$35 × 3 días = $105');
    expect(writtenRentalTotal(null, 3, totals.total)).toBe('—');
  });

  it('con tarifa escrita y con seguro el texto no promete una multiplicación que no da', () => {
    const plain = agreementTotals({
      dailyRate: '40.00',
      cdwPerDay: '0.00',
      billableDays: 2,
      extraCharges: '0.00',
      extraKmCharge: '0.00',
      finesCharged: '0.00',
      discount: '0.00',
      payments: [],
    });
    const insuredInput = {
      dailyRate: '35.00',
      cdwPerDay: '5.00',
      billableDays: 3,
      extraCharges: '0.00',
      extraKmCharge: '0.00',
      finesCharged: '0.00',
      discount: '0.00',
      payments: [],
    };
    const insured = agreementTotals(insuredInput);
    const both = agreementTotals({ ...insuredInput, discount: '10.00' });

    expect(writtenRentalTotal('40.00', 2, plain.total)).toBe('$40 × 2 días = $80');
    expect(writtenRentalTotal('35.00', 3, insured.total, { cdwPerDay: '5.00' })).toBe(
      '$35 × 3 días + seguro = $120',
    );
    expect(
      writtenRentalTotal('35.00', 3, both.total, { cdwPerDay: '5.00', discount: '10.00' }),
    ).toBe('Total $110');
  });

  it('la edición manda solo lo que cambió', () => {
    const original = {
      ...EMPTY_AGREEMENT_FORM,
      plannedPickupAt: '2026-10-10T10:00',
      plannedReturnAt: '2026-10-12T10:00',
      billableDays: '2',
      deposit: '100.00',
    };

    expect(
      agreementUpdateDraft({ ...original, plannedReturnAt: '2026-10-14T10:00' }, original, true),
    ).toEqual({ plannedReturnAt: '2026-10-14T16:00:00.000Z' });
  });
});
