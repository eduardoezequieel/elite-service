import {
  bankAccountOptionLabel,
  bankAccountShortLabel,
  bankShortName,
  maskedAccountNumber,
} from './bank-account-format';

describe('cómo se nombra una cuenta del negocio (069)', () => {
  it('quita «Banco » solo delante de un nombre propio', () => {
    expect(bankShortName('Banco Agrícola')).toBe('Agrícola');
    expect(bankShortName('BAC Credomatic')).toBe('BAC Credomatic');
    expect(bankShortName('Banco de Fomento Agropecuario')).toBe('Banco de Fomento Agropecuario');
    expect(bankShortName('Fedecrédito')).toBe('Fedecrédito');
  });

  it('enmascara el número a los últimos cuatro dígitos', () => {
    expect(maskedAccountNumber('0012345678')).toBe('···5678');
    expect(maskedAccountNumber('1234')).toBe('1234');
  });

  it('el selector del cobro lleva banco, tipo y número entero', () => {
    expect(
      bankAccountOptionLabel({
        bankName: 'Banco Agrícola',
        type: 'CHECKING',
        number: '0012345678',
      }),
    ).toBe('Agrícola · Corriente · 0012345678');
    expect(
      bankAccountOptionLabel({ bankName: 'BAC Credomatic', type: 'SAVINGS', number: '998877' }),
    ).toBe('BAC Credomatic · Ahorro · 998877');
  });

  it('la estampa lleva banco y los últimos cuatro', () => {
    expect(bankAccountShortLabel({ bankName: 'Banco Agrícola', number: '0012345678' })).toBe(
      'Agrícola ···5678',
    );
  });
});
