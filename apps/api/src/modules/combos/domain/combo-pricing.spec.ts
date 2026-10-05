import {
  comboPriceFor,
  discountedPrice,
  expandCombo,
  listPriceFor,
  outOfStockNames,
  prorate,
  unitListPrice,
  type ComboComponent,
  type ComboPricing,
} from './combo-pricing';

const SEDAN = 'sedan';
const SUV = 'suv';

function service(id: string, defaultPrice: number, suvPrice?: number): ComboComponent {
  return {
    kind: 'SERVICE',
    serviceId: id,
    inventoryItemId: null,
    code: `SRV-${id}`,
    name: `Servicio ${id}`,
    taxRate: '0.1300',
    quantity: 1,
    defaultPrice,
    prices: suvPrice === undefined ? [] : [{ bodyTypeId: SUV, price: suvPrice }],
    stockOnHand: null,
  };
}

function product(id: string, price: number, quantity: number, stock = 10_000): ComboComponent {
  return {
    kind: 'PRODUCT',
    serviceId: null,
    inventoryItemId: id,
    code: `INV-${id}`,
    name: `Producto ${id}`,
    taxRate: '0.1300',
    quantity,
    defaultPrice: price,
    prices: [],
    stockOnHand: stock,
  };
}

function lineSum(lines: ReturnType<typeof expandCombo>): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.component.quantity, 0);
}

describe('precio de lista (104 RN-2)', () => {
  it('un servicio usa la fila de su matriz o, sin ella, el base', () => {
    expect(unitListPrice(service('a', 1000, 1400), SUV)).toBe(1400);
    expect(unitListPrice(service('a', 1000, 1400), SEDAN)).toBe(1000);
  });

  it('suma servicios y productos × cantidad', () => {
    const components = [service('a', 1000, 1400), product('p', 250, 3)];

    expect(listPriceFor(components, SEDAN)).toBe(1750);
    expect(listPriceFor(components, SUV)).toBe(2150);
  });
});

describe('precio del combo', () => {
  it('PERCENT redondea mitad hacia arriba al centavo (criterio 2)', () => {
    // 10.05 × 0.85 = 8.5425 → 8.54; 10.10 × 0.85 = 8.585 → 8.59
    expect(discountedPrice(1005, 15)).toBe(854);
    expect(discountedPrice(1010, 15)).toBe(859);
    expect(discountedPrice(1000, 90)).toBe(100);
  });

  it('PERCENT se calcula por tipo de carro sobre la suma de hoy', () => {
    const pricing: ComboPricing = {
      pricingMode: 'PERCENT',
      discountPercent: 10,
      fixedPrices: [],
      components: [service('a', 1000, 1400), product('p', 500, 1)],
    };

    expect(comboPriceFor(pricing, SEDAN)).toBe(1350);
    expect(comboPriceFor(pricing, SUV)).toBe(1710);
  });

  it('FIXED usa el guardado y, sin fila para ese tipo, la suma por separado', () => {
    const pricing: ComboPricing = {
      pricingMode: 'FIXED',
      discountPercent: null,
      fixedPrices: [{ bodyTypeId: SEDAN, price: 1200 }],
      components: [service('a', 1000, 1400), product('p', 500, 1)],
    };

    expect(comboPriceFor(pricing, SEDAN)).toBe(1200);
    expect(comboPriceFor(pricing, SUV)).toBe(1900);
  });
});

describe('prorate (104 RN-5)', () => {
  it('reparte en proporción y deja el residuo en la primera línea de servicio', () => {
    // suma 19.00, combo 15.00
    const units = prorate(
      [
        { kind: 'SERVICE', unitListPrice: 1000, quantity: 1 },
        { kind: 'SERVICE', unitListPrice: 500, quantity: 1 },
        { kind: 'PRODUCT', unitListPrice: 200, quantity: 2 },
      ],
      1500,
    );

    // 789.47 → 789, 394.73 → 394, 157.89 → 157 (×2 = 314); residuo 3
    expect(units).toEqual([792, 394, 157]);
    expect(units[0] + units[1] + units[2] * 2).toBe(1500);
  });

  it('el residuo va al primer servicio aunque un producto venga antes', () => {
    const units = prorate(
      [
        { kind: 'PRODUCT', unitListPrice: 333, quantity: 3 },
        { kind: 'SERVICE', unitListPrice: 1001, quantity: 1 },
      ],
      1700,
    );

    // suma 20.00: producto 333 × 1700 / 2000 = 283.05 → 283 (×3 = 849)
    expect(units[0]).toBe(283);
    expect(units[0] * 3 + units[1]).toBe(1700);
  });

  it('un producto nunca supera su precio de lista, aunque el combo quede sobre la suma', () => {
    const units = prorate(
      [
        { kind: 'SERVICE', unitListPrice: 500, quantity: 1 },
        { kind: 'PRODUCT', unitListPrice: 500, quantity: 2 },
      ],
      2000,
    );

    expect(units).toEqual([1000, 500]);
  });

  it('con suma cero todo va al servicio', () => {
    expect(
      prorate(
        [
          { kind: 'SERVICE', unitListPrice: 0, quantity: 1 },
          { kind: 'PRODUCT', unitListPrice: 0, quantity: 1 },
        ],
        900,
      ),
    ).toEqual([900, 0]);
  });

  it.each([
    [1, 1999],
    [7, 1234],
    [99, 3333],
    [101, 10_000],
  ])('cierra exacto y sin pasar el catálogo (semilla %p, precio %p)', (seed, comboPrice) => {
    const lines = [
      { kind: 'SERVICE' as const, unitListPrice: 1000 + seed, quantity: 1 },
      { kind: 'PRODUCT' as const, unitListPrice: 333 + seed, quantity: 3 },
      { kind: 'SERVICE' as const, unitListPrice: 777, quantity: 1 },
      { kind: 'PRODUCT' as const, unitListPrice: 99, quantity: 7 },
    ];
    const units = prorate(lines, comboPrice);
    const sum = units.reduce((total, unit, index) => total + unit * lines[index].quantity, 0);

    expect(sum).toBe(comboPrice);
    lines.forEach((line, index) => {
      if (line.kind === 'PRODUCT') expect(units[index]).toBeLessThanOrEqual(line.unitListPrice);
    });
  });
});

describe('expandCombo', () => {
  it('cada línea lleva el precio de lista como catalogPrice y la suma es el precio del combo', () => {
    const pricing: ComboPricing = {
      pricingMode: 'FIXED',
      discountPercent: null,
      fixedPrices: [
        { bodyTypeId: SEDAN, price: 1499 },
        { bodyTypeId: SUV, price: 1899 },
      ],
      components: [service('a', 1000, 1400), service('b', 500), product('p', 275, 2)],
    };

    const sedan = expandCombo(pricing, SEDAN);
    const suv = expandCombo(pricing, SUV);

    expect(sedan.map((line) => line.catalogPrice)).toEqual([1000, 500, 275]);
    expect(suv.map((line) => line.catalogPrice)).toEqual([1400, 500, 275]);
    expect(lineSum(sedan)).toBe(1499);
    expect(lineSum(suv)).toBe(1899);
  });

  it('PERCENT también cierra exacto', () => {
    const pricing: ComboPricing = {
      pricingMode: 'PERCENT',
      discountPercent: 17,
      fixedPrices: [],
      components: [service('a', 1234), product('p', 333, 3)],
    };

    expect(lineSum(expandCombo(pricing, SEDAN))).toBe(discountedPrice(1234 + 999, 17));
  });
});

describe('outOfStockNames (criterio 5)', () => {
  it('nombra los productos sin existencia para una unidad del combo', () => {
    expect(
      outOfStockNames([service('a', 1000), product('p', 100, 2, 1999), product('q', 100, 2, 2000)]),
    ).toEqual(['Producto p']);
  });
});
