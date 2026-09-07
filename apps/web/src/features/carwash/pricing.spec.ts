import {
  clampToCatalog,
  discountBy,
  discountByPercent,
  discountCents,
  formatMoney,
  maskMoneyInput,
  toCents,
} from './pricing';

describe('dinero del alta (spec 030)', () => {
  it('convierte a centavos y vuelve con dos decimales', () => {
    expect(toCents('8.50')).toBe(850);
    expect(toCents('8,50')).toBe(850);
    expect(toCents('10')).toBe(1000);
    expect(toCents('')).toBe(0);
    expect(formatMoney(850)).toBe('8.50');
    expect(formatMoney(0)).toBe('0.00');
  });

  it('deja teclear solo dígitos y un separador, con dos decimales', () => {
    expect(maskMoneyInput('8.50')).toBe('8.50');
    expect(maskMoneyInput('8,5')).toBe('8.5');
    expect(maskMoneyInput('8.5.7')).toBe('8.57');
    expect(maskMoneyInput('a8b.c50')).toBe('8.50');
    expect(maskMoneyInput('8.567')).toBe('8.56');
    expect(maskMoneyInput('')).toBe('');
  });

  it('el descuento solo baja: recorta al catálogo y a cero (022 RN-5)', () => {
    expect(clampToCatalog('6.00', '8.00')).toBe('6.00');
    expect(clampToCatalog('99', '8.00')).toBe('8.00');
    expect(clampToCatalog('-3', '8.00')).toBe('0.00');
    expect(clampToCatalog('4,50', '8.00')).toBe('4.50');
  });

  it('un campo vacío o ilegible vuelve al precio de catálogo', () => {
    expect(clampToCatalog('', '8.00')).toBe('8.00');
    expect(clampToCatalog('   ', '8.00')).toBe('8.00');
    expect(clampToCatalog('.', '8.00')).toBe('8.00');
  });

  it('mide el descuento respecto del catálogo', () => {
    expect(discountCents('8.00', '6.00')).toBe(200);
    expect(discountCents('8.00', '8.00')).toBe(0);
    expect(discountCents('8.00', '9.00')).toBe(0);
  });

  it('aplica los atajos de descuento sin pasarse del catálogo', () => {
    expect(discountBy('8.00', 2)).toBe('6.00');
    expect(discountBy('8.00', 20)).toBe('0.00');
    expect(discountByPercent('10.00', 10)).toBe('9.00');
    expect(discountByPercent('8.00', 100)).toBe('0.00');
  });
});
