import {
  applyMovement,
  fromQuantityString,
  InsufficientStockError,
  lowStockTransition,
  toQuantityString,
} from './stock';

describe('cantidades en milésimas', () => {
  it.each([
    ['2.500', 2500],
    ['2', 2000],
    ['0.001', 1],
    ['-3.000', -3000],
    ['10.5', 10500],
  ])('%s → %d', (text, milli) => {
    expect(fromQuantityString(text)).toBe(milli);
  });

  it.each([
    [2500, '2.500'],
    [0, '0.000'],
    [-4000, '-4.000'],
    [1, '0.001'],
  ])('%d → %s', (milli, text) => {
    expect(toQuantityString(milli)).toBe(text);
  });

  it('rechaza más de tres decimales o texto', () => {
    expect(() => fromQuantityString('1.2345')).toThrow();
    expect(() => fromQuantityString('abc')).toThrow();
  });
});

describe('applyMovement (RN-3)', () => {
  it('suma y resta con signo', () => {
    expect(applyMovement('i', 3000, -2000)).toBe(1000);
    expect(applyMovement('i', 1000, 2000)).toBe(3000);
  });

  it('puede dejar la existencia exactamente en cero', () => {
    expect(applyMovement('i', 2000, -2000)).toBe(0);
  });

  it('nunca deja negativo y cuenta cuánto hay', () => {
    try {
      applyMovement('item-1', 1000, -2000);
      throw new Error('no lanzó');
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientStockError);
      expect((error as InsufficientStockError).itemId).toBe('item-1');
      expect((error as InsufficientStockError).available).toBe('1.000');
    }
  });
});

describe('lowStockTransition (RN-13)', () => {
  it('avisa al cruzar el mínimo viniendo de arriba', () => {
    expect(lowStockTransition(5000, 5000, false)).toEqual({ notify: true, notified: true });
  });

  it('no repite mientras sigue abajo', () => {
    expect(lowStockTransition(3000, 5000, true)).toEqual({ notify: false, notified: true });
  });

  it('se rearma al pasar el mínimo', () => {
    expect(lowStockTransition(6000, 5000, true)).toEqual({ notify: false, notified: false });
  });

  it('sin mínimo nunca avisa', () => {
    expect(lowStockTransition(0, 0, false)).toEqual({ notify: false, notified: false });
  });
});
