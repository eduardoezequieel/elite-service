import { carPaint, carPaintToken } from './car-paint';

describe('carPaint (115, RN-3)', () => {
  it('toma la primera palabra de la paleta, sin tildes ni mayúsculas', () => {
    expect(carPaint('Rojo')).toBe('red');
    expect(carPaint('gris oscuro')).toBe('gray');
    expect(carPaint('Plateado')).toBe('silver');
    expect(carPaint('Café')).toBe('brown');
    expect(carPaint('Rojo vino')).toBe('red');
    expect(carPaint('Corinto')).toBe('wine');
  });

  it('lo que no coincide, o no hay color, sale gris', () => {
    expect(carPaint('Tornasol')).toBe('gray');
    expect(carPaint('')).toBe('gray');
    expect(carPaint(null)).toBe('gray');
  });

  it('el token es el de globals.css', () => {
    expect(carPaintToken('wine')).toBe('--car-paint-wine');
  });
});
