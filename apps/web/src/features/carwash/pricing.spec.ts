import {
  discountCents,
  maskMoneyInput,
  normalizeServicePrice,
  rebaseServicePrice,
  surchargeCents,
} from './pricing';

describe('dinero del alta (spec 030)', () => {
  it('deja teclear solo dígitos y un separador, con dos decimales', () => {
    expect(maskMoneyInput('8.50')).toBe('8.50');
    expect(maskMoneyInput('8,5')).toBe('8.5');
    expect(maskMoneyInput('8.5.7')).toBe('8.57');
    expect(maskMoneyInput('a8b.c50')).toBe('8.50');
    expect(maskMoneyInput('8.567')).toBe('8.56');
    expect(maskMoneyInput('')).toBe('');
  });

  it('un servicio sube o baja, con piso en cero (087)', () => {
    expect(normalizeServicePrice('6.00', '8.00')).toBe('6.00');
    expect(normalizeServicePrice('99', '8.00')).toBe('99.00');
    expect(normalizeServicePrice('-3', '8.00')).toBe('0.00');
    expect(normalizeServicePrice('4,50', '8.00')).toBe('4.50');
  });

  it('un campo vacío o ilegible vuelve al precio de catálogo', () => {
    expect(normalizeServicePrice('', '8.00')).toBe('8.00');
    expect(normalizeServicePrice('   ', '8.00')).toBe('8.00');
    expect(normalizeServicePrice('.', '8.00')).toBe('8.00');
  });

  it('al cambiar el tipo de carro, el precio no cambia de lado del catálogo (087)', () => {
    expect(rebaseServicePrice('8.00', '8.00', '10.00')).toBe('10.00');
    expect(rebaseServicePrice('6.00', '8.00', '10.00')).toBe('6.00');
    expect(rebaseServicePrice('6.00', '8.00', '4.00')).toBe('4.00');
    expect(rebaseServicePrice('12.00', '8.00', '10.00')).toBe('12.00');
    expect(rebaseServicePrice('9.00', '8.00', '10.00')).toBe('10.00');
  });

  it('mide el descuento y el recargo respecto del catálogo', () => {
    expect(discountCents('8.00', '6.00')).toBe(200);
    expect(discountCents('8.00', '8.00')).toBe(0);
    expect(discountCents('8.00', '9.00')).toBe(0);
    expect(surchargeCents('8.00', '9.50')).toBe(150);
    expect(surchargeCents('8.00', '6.00')).toBe(0);
  });
});
