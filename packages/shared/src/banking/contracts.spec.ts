import { BANKS, BANK_NAMES, bankName, isBankCode } from './contracts';

describe('bankName', () => {
  it('traduce un código conocido a su nombre visible', () => {
    expect(bankName('AGRICOLA')).toBe('Banco Agrícola');
    expect(bankName('BAC')).toBe('BAC Credomatic');
  });

  it('devuelve tal cual un código que no está en la lista (dato viejo)', () => {
    expect(bankName('BANCO_CERRADO')).toBe('BANCO_CERRADO');
    expect(bankName('')).toBe('');
  });

  it('distingue mayúsculas: el código guardado es en mayúsculas', () => {
    expect(bankName('agricola')).toBe('agricola');
  });

  it('tiene nombre para cada banco de la lista', () => {
    for (const bank of BANKS) {
      expect(bankName(bank.code)).toBe(bank.name);
      expect(BANK_NAMES[bank.code]).toBe(bank.name);
    }
  });
});

describe('isBankCode', () => {
  it('reconoce los códigos de la lista y nada más', () => {
    expect(isBankCode('CUSCATLAN')).toBe(true);
    expect(isBankCode('Banco Cuscatlán')).toBe(false);
    expect(isBankCode('toString')).toBe(false);
  });
});
