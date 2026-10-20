import {
  renewalExpenseInput,
  renewalVehicleInput,
  suggestedExpiry,
  validateRenewal,
} from './document-renewal';

const today = '2026-10-19';

describe('document-renewal (122)', () => {
  it('propone un año después del vencimiento vigente, o de hoy', () => {
    expect(suggestedExpiry('2026-11-30', today)).toBe('2027-11-30');
    expect(suggestedExpiry('2026-01-10', today)).toBe('2027-10-19');
    expect(suggestedExpiry(null, '2028-02-29')).toBe('2029-02-28');
  });

  it('pide fecha nueva desde hoy y un costo válido si se escribe', () => {
    expect(validateRenewal({ cost: '', paidAt: today, expiresAt: today }, today)).toEqual({});
    expect(validateRenewal({ cost: 'abc', paidAt: '', expiresAt: '2026-10-18' }, today)).toEqual({
      cost: expect.any(String),
      paidAt: 'Elija la fecha.',
      expiresAt: 'No puede ser antes de hoy.',
    });
    expect(validateRenewal({ cost: '', paidAt: today, expiresAt: '' }, today).expiresAt).toBe(
      'Elija la nueva fecha de vencimiento.',
    );
  });

  it('cambia solo la fecha del papel y anota el gasto con su tipo', () => {
    expect(renewalVehicleInput('INSURANCE', '2027-10-19')).toEqual({
      insuranceExpiresAt: '2027-10-19',
    });
    expect(renewalVehicleInput('REGISTRATION', '2027-10-19')).toEqual({
      registrationExpiresAt: '2027-10-19',
    });

    const values = { cost: '120,5', paidAt: today, expiresAt: '2027-10-19' };
    expect(renewalExpenseInput('INSURANCE', 'v1', values)).toEqual({
      vehicleId: 'v1',
      type: 'INSURANCE',
      amount: '120.5',
      incurredAt: today,
    });
    expect(renewalExpenseInput('REGISTRATION', 'v1', values)).toMatchObject({
      type: 'OTHER',
      description: 'Tarjeta de circulación',
    });
    expect(renewalExpenseInput('INSURANCE', 'v1', { ...values, cost: ' ' })).toBeNull();
  });
});
