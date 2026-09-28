import {
  centsParts,
  centsToAmount,
  formatCents,
  formatMoney,
  moneyParts,
  parseCents,
  toCents,
} from './money';

describe('dinero (076)', () => {
  it('un monto del API se lee con su símbolo', () => {
    expect(formatMoney('14.00')).toBe('$14.00');
  });

  it('los centavos se leen con su símbolo y el signo adelante', () => {
    expect(formatCents(1250)).toBe('$12.50');
    expect(formatCents(250)).toBe('$2.50');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(-300)).toBe('-$3.00');
  });

  it('un monto del API pasa a centavos, o a null si no es un monto', () => {
    expect(toCents('8.50')).toBe(850);
    expect(toCents('8.5')).toBe(850);
    expect(toCents('-3.00')).toBe(-300);
    expect(toCents('8,50')).toBeNull();
    expect(toCents('')).toBeNull();
  });

  it('lo que se teclea pasa a centavos aceptando coma, y lo ilegible es cero', () => {
    expect(parseCents('8.50')).toBe(850);
    expect(parseCents('8,50')).toBe(850);
    expect(parseCents('10')).toBe(1000);
    expect(parseCents('')).toBe(0);
  });

  it('los centavos vuelven a monto sin símbolo, como lo espera el API', () => {
    expect(centsToAmount(850)).toBe('8.50');
    expect(centsToAmount(0)).toBe('0.00');
  });

  it('parte la cifra en dos tamaños', () => {
    expect(moneyParts('148.5')).toEqual({ whole: '$148', fraction: '.50' });
    expect(moneyParts('20')).toEqual({ whole: '$20', fraction: '.00' });
    expect(centsParts(14800)).toEqual({ whole: '$148', fraction: '.00' });
    expect(centsParts(1205)).toEqual({ whole: '$12', fraction: '.05' });
  });
});
