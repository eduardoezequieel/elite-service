import {
  EMPTY_AGREEMENT_FORM,
  agreementFormDefaults,
  agreementUpdateDraft,
  createAgreementFormSchema,
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
      plannedPickupAt: '2026-10-10T09:00',
      plannedReturnAt: '2026-10-11T09:00',
    });
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
