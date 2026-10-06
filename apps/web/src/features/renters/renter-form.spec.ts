import { EMPTY_RENTER_FORM, createRenterFormSchema, renterDraft } from './renter-form';
import { ageOn, renterAlerts } from './renter-alerts';

describe('formulario de cliente de renta (095)', () => {
  it('arma el alta con fechas del contrato y vacíos en null', () => {
    const parsed = createRenterFormSchema.parse({
      ...EMPTY_RENTER_FORM,
      fullName: 'Ana López',
      documentId: '01234567-8',
      mobilePhone: '7777-8888',
      birthDate: '05/03/1990',
      email: '',
    });

    expect(parsed).toMatchObject({
      fullName: 'Ana López',
      documentId: '01234567-8',
      mobilePhone: '7777-8888',
      birthDate: '1990-03-05',
      email: null,
      isBlocked: false,
    });
  });

  it('pide documento y celular', () => {
    const result = createRenterFormSchema.safeParse({
      ...EMPTY_RENTER_FORM,
      fullName: 'Ana López',
    });

    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining(['Escribí el DUI o el pasaporte.', 'Escribí el celular.']),
    );
  });

  it('bloquear pide motivo', () => {
    const result = createRenterFormSchema.safeParse({
      ...EMPTY_RENTER_FORM,
      fullName: 'Ana',
      documentId: '01234567-8',
      mobilePhone: '7777-8888',
      isBlocked: true,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['blockReason']);
  });

  it('sin bloqueo no viaja el motivo', () => {
    expect(renterDraft({ ...EMPTY_RENTER_FORM, blockReason: 'viejo' }).blockReason).toBeNull();
  });
});

describe('renterAlerts', () => {
  const base = {
    isBlocked: false,
    blockReason: null,
    isActive: true,
    licenseExpiresAt: null,
    birthDate: null,
  };

  it('licencia vencida y menor de edad mínima', () => {
    const alerts = renterAlerts(
      { ...base, licenseExpiresAt: '2026-09-30', birthDate: '2006-10-02' },
      '2026-10-01',
      21,
    );

    expect(alerts.map((alert) => alert.key)).toEqual(['license-expired', 'underage']);
    expect(alerts[1]?.message).toBe('Tiene 19 años: la edad mínima es 21.');
  });

  it('no rentar con su motivo', () => {
    expect(
      renterAlerts({ ...base, isBlocked: true, blockReason: 'Chocó' }, '2026-10-01', 21),
    ).toEqual([{ key: 'blocked', message: 'No rentar: Chocó' }]);
  });

  it('la edad cumple el día del cumpleaños', () => {
    expect(ageOn('2005-10-01', '2026-10-01')).toBe(21);
    expect(ageOn('2005-10-02', '2026-10-01')).toBe(20);
  });
});
