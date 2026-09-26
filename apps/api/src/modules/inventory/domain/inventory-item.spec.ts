import {
  isLowStock,
  lowStockFlagAfterMinChange,
  ProductPriceRequiredError,
  resolveItemPrice,
  SupplyHasPriceError,
} from './inventory-item';

describe('resolveItemPrice (RN-1)', () => {
  it('un insumo guarda cero', () => {
    expect(resolveItemPrice('SUPPLY', undefined)).toBe(0);
    expect(resolveItemPrice('SUPPLY', 0)).toBe(0);
  });

  it('un insumo con precio se rechaza', () => {
    expect(() => resolveItemPrice('SUPPLY', 100)).toThrow(SupplyHasPriceError);
  });

  it('un producto exige precio mayor que cero', () => {
    expect(resolveItemPrice('PRODUCT', 300)).toBe(300);
    expect(() => resolveItemPrice('PRODUCT', 0)).toThrow(ProductPriceRequiredError);
    expect(() => resolveItemPrice('PRODUCT', undefined)).toThrow(ProductPriceRequiredError);
  });
});

describe('isLowStock (RN-13)', () => {
  it('en o bajo el mínimo', () => {
    expect(isLowStock(5000, 5000)).toBe(true);
    expect(isLowStock(4000, 5000)).toBe(true);
    expect(isLowStock(6000, 5000)).toBe(false);
  });

  it('sin mínimo nunca', () => {
    expect(isLowStock(0, 0)).toBe(false);
  });
});

describe('lowStockFlagAfterMinChange', () => {
  it('se rearma si la existencia queda arriba del mínimo nuevo', () => {
    expect(lowStockFlagAfterMinChange(6000, 5000, true)).toBe(false);
  });

  it('conserva el estado si queda en o bajo', () => {
    expect(lowStockFlagAfterMinChange(3000, 5000, true)).toBe(true);
    expect(lowStockFlagAfterMinChange(3000, 5000, false)).toBe(false);
  });

  it('quitar el mínimo lo rearma', () => {
    expect(lowStockFlagAfterMinChange(0, 0, true)).toBe(false);
  });
});
