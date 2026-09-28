import { bankAccountErrorView } from './errors';

describe('los errores de las cuentas (069)', () => {
  it('el duplicado se planta en el número', () => {
    const view = bankAccountErrorView({ code: 'BANK_ACCOUNT_DUPLICATE', message: 'dup' });

    expect(view.fields.number).toMatch(/ese banco y ese número/);
    expect(view.message).toBe(view.fields.number);
  });

  it('la validación baja a los campos que conoce', () => {
    expect(
      bankAccountErrorView({
        code: 'VALIDATION_ERROR',
        message: 'Revisá los datos.',
        details: { holderName: ['Escribí el titular de la cuenta.'], other: 'x' },
      }),
    ).toEqual({
      message: 'Revisá los datos.',
      fields: { holderName: 'Escribí el titular de la cuenta.' },
    });
  });

  it('lo demás queda en el mensaje general', () => {
    expect(bankAccountErrorView({ code: 'FORBIDDEN', message: 'No.' })).toEqual({
      message: 'No.',
      fields: {},
    });
  });
});
