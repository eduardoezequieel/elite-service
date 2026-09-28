import {
  formatQuantity,
  formatQuantityWithUnit,
  formatSignedQuantity,
  milliToQuantity,
  quantityMilli,
} from './quantity';

describe('cantidades (065 RN-16, 076)', () => {
  it('cuenta en milésimas enteras, con y sin signo', () => {
    expect(quantityMilli('2.500')).toBe(2500);
    expect(quantityMilli('-2.000')).toBe(-2000);
    expect(quantityMilli('+10')).toBe(10000);
    expect(quantityMilli('0.001')).toBe(1);
    expect(quantityMilli('dos')).toBeNull();
    expect(quantityMilli('1.2345')).toBeNull();
  });

  it('vuelve a cadena de tres decimales para el API', () => {
    expect(milliToQuantity(2000)).toBe('2.000');
    expect(milliToQuantity(2500)).toBe('2.500');
    expect(milliToQuantity(1)).toBe('0.001');
    expect(milliToQuantity(7)).toBe('0.007');
    expect(milliToQuantity(-1000)).toBe('-1.000');
    expect(milliToQuantity(-500)).toBe('-0.500');
  });

  it('se lee sin los ceros que sobran', () => {
    expect(formatQuantity('10.000')).toBe('10');
    expect(formatQuantity('2.500')).toBe('2.5');
    expect(formatQuantity('0.125')).toBe('0.125');
    expect(formatQuantity('0.000')).toBe('0');
    expect(formatQuantity('-2.000')).toBe('−2');
  });

  it('lleva el signo siempre a la vista en el kardex', () => {
    expect(formatSignedQuantity('10.000')).toBe('+10');
    expect(formatSignedQuantity('-4.000')).toBe('−4');
  });

  it('pega la unidad tal cual la escribió el taller', () => {
    expect(formatQuantityWithUnit('4.000', 'litro')).toBe('4 litro');
    expect(formatQuantityWithUnit('10.000', 'unidad')).toBe('10 unidad');
    expect(formatQuantityWithUnit('4.000', '  ')).toBe('4');
  });
});
