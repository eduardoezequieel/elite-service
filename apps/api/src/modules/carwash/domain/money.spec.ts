import { formatMoney, fromDecimalString, toCents, toDecimalString } from './money';

describe('money', () => {
  describe('fromDecimalString', () => {
    it.each([
      ['8.00', 800],
      ['10', 1000],
      ['14.5', 1450],
      ['0.07', 7],
      ['0', 0],
      ['1234567.89', 123456789],
    ])('lee %s como %i centavos', (value, cents) => {
      expect(fromDecimalString(value)).toBe(cents);
    });

    it('tolera espacios alrededor, que es como a veces llega de la base', () => {
      expect(fromDecimalString('  8.00  ')).toBe(800);
    });

    it.each(['', 'ocho', '8.001', '8,00', '$8.00', '1e3'])('rechaza %s', (value) => {
      expect(() => fromDecimalString(value)).toThrow();
    });
  });

  describe('toDecimalString', () => {
    it.each([
      [800, '8.00'],
      [1000, '10.00'],
      [7, '0.07'],
      [0, '0.00'],
      [123456789, '1234567.89'],
    ])('escribe %i como %s', (cents, value) => {
      expect(toDecimalString(cents)).toBe(value);
    });
  });

  it('ida y vuelta no pierde nada', () => {
    for (const value of ['0.00', '0.01', '8.00', '10.50', '14.99', '99999.99']) {
      expect(toDecimalString(fromDecimalString(value))).toBe(value);
    }
  });

  /**
   * La razon de ser de este modulo. Con decimales flotantes la suma de tres
   * lineas de 8.10 da 24.299999999999997, y RN-10 exige que el monto cobrado
   * sea IGUAL al total: el cobro se caeria por un error invisible en pantalla.
   */
  it('suma exacto donde el punto flotante no lo hace', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));

    const tresLineas = toCents(8.1) * 3;

    expect(toDecimalString(tresLineas)).toBe('24.30');
  });

  describe('toCents', () => {
    it('acepta numero y cadena por igual', () => {
      expect(toCents(8)).toBe(800);
      expect(toCents('8')).toBe(800);
      expect(toCents(8.5)).toBe(850);
      expect(toCents('8.50')).toBe(850);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY])('rechaza %p', (value) => {
      expect(() => toCents(value)).toThrow();
    });
  });

  it('formatea para mostrar', () => {
    expect(formatMoney(1050)).toBe('$10.50');
    expect(formatMoney(0)).toBe('$0.00');
  });
});
