import type { TicketItem } from '@elite/shared';

import {
  ONE_UNIT,
  activeShortage,
  availableAfter,
  formatQuantity,
  itemLabel,
  lineFormula,
  lineTotalCents,
  linesCountLabel,
  originalQuantities,
  productItemsPayload,
  productSignature,
  productsFromTicket,
  productsTotalCents,
  quantityLabel,
  quantityWithUnit,
  stepProduct,
  stockShortageOf,
  toMilli,
  unitLabel,
} from './product-lines';

function item(overrides: Partial<TicketItem> = {}): TicketItem {
  return {
    id: 'l-1',
    kind: 'SERVICE',
    serviceId: 's-1',
    inventoryItemId: null,
    code: 'LAV-01',
    name: 'Lavado completo',
    serviceCode: 'LAV-01',
    serviceName: 'Lavado completo',
    catalogPrice: '10.00',
    unitPrice: '10.00',
    quantity: '1.000',
    total: '10.00',
    sortOrder: 0,
    priceAuthorizedBy: null,
    priceAuthorizedAt: null,
    priceReason: null,
    previousUnitPrice: null,
    ...overrides,
  };
}

const wax = item({
  id: 'l-2',
  kind: 'PRODUCT',
  serviceId: null,
  inventoryItemId: 'inv-wax',
  code: 'INV-0001',
  name: 'Cera en pasta',
  serviceCode: 'INV-0001',
  serviceName: 'Cera en pasta',
  catalogPrice: '3.00',
  unitPrice: '3.00',
  quantity: '2.000',
  total: '6.00',
});

const option = { id: 'inv-wax', name: 'Cera en pasta', price: '3.00' };

describe('cantidades en milésimas (065 RN-6)', () => {
  it('lee y escribe tres decimales sin coma flotante', () => {
    expect(toMilli('2.000')).toBe(2000);
    expect(toMilli('2.5')).toBe(2500);
    expect(toMilli('0,125')).toBe(125);
    expect(toMilli('-1.500')).toBe(-1500);
    expect(toMilli('no')).toBe(0);
    expect(formatQuantity(2000)).toBe('2.000');
    expect(formatQuantity(2500)).toBe('2.500');
    expect(formatQuantity(-500)).toBe('-0.500');
  });

  it('se lee sin ceros de relleno', () => {
    expect(quantityLabel(2000)).toBe('2');
    expect(quantityLabel(1500)).toBe('1.5');
    expect(quantityLabel(250)).toBe('0.25');
  });

  it('pone la unidad en plural cuando no es uno, y deja las abreviaturas', () => {
    expect(unitLabel('unidad', 4000)).toBe('unidades');
    expect(unitLabel('unidad', ONE_UNIT)).toBe('unidad');
    expect(unitLabel('galón', 2000)).toBe('galones');
    expect(unitLabel('par', 3000)).toBe('pares');
    expect(unitLabel('caja', 2000)).toBe('cajas');
    expect(unitLabel('ml', 500)).toBe('ml');
    expect(quantityWithUnit(4000, 'unidad')).toBe('4 unidades');
    expect(quantityWithUnit(2500, 'litro')).toBe('2.5 litros');
    expect(quantityWithUnit(1000, '')).toBe('1');
  });
});

describe('total de la línea', () => {
  it('multiplica precio por cantidad y redondea al centavo', () => {
    expect(lineTotalCents('3.00', 2000)).toBe(600);
    expect(lineTotalCents('3.33', 1500)).toBe(500);
    expect(lineTotalCents('0.00', 5000)).toBe(0);
  });

  it('se escribe «2 × $3.00 = $6.00»', () => {
    expect(lineFormula('3.00', 2000)).toBe('2 × $3.00 = $6.00');
    expect(lineFormula('4', 1500)).toBe('1.5 × $4.00 = $6.00');
  });
});

describe('resúmenes de una fila', () => {
  it('el producto con más de una unidad lleva su ×N; el servicio no', () => {
    expect(itemLabel(wax)).toBe('Cera en pasta ×2');
    expect(itemLabel({ ...wax, quantity: '1.000' })).toBe('Cera en pasta');
    expect(itemLabel(item())).toBe('Lavado completo');
  });

  it('cuenta servicios y productos por separado', () => {
    expect(linesCountLabel([item()])).toBe('1 servicio');
    expect(linesCountLabel([item(), item(), wax])).toBe('2 servicios · 1 producto');
  });
});

describe('la selección de productos', () => {
  it('lee del lavado solo las líneas de producto', () => {
    expect(productsFromTicket([item(), wax])).toEqual([
      {
        inventoryItemId: 'inv-wax',
        name: 'Cera en pasta',
        catalogPrice: '3.00',
        unitPrice: '3.00',
        quantity: 2000,
      },
    ]);
    expect(originalQuantities([item(), wax])).toEqual({ 'inv-wax': 2000 });
  });

  it('el + agrega con el precio del artículo y suma de a uno', () => {
    const once = stepProduct([], option, ONE_UNIT);
    const twice = stepProduct(once, option, ONE_UNIT);

    expect(once).toEqual([
      {
        inventoryItemId: 'inv-wax',
        name: 'Cera en pasta',
        catalogPrice: '3.00',
        unitPrice: '3.00',
        quantity: 1000,
      },
    ]);
    expect(twice[0]?.quantity).toBe(2000);
    expect(twice).toHaveLength(1);
  });

  it('el − baja y en cero quita la línea; un − sobre nada no hace nada', () => {
    const two = stepProduct(stepProduct([], option, ONE_UNIT), option, ONE_UNIT);

    expect(stepProduct(two, option, -ONE_UNIT)[0]?.quantity).toBe(1000);
    expect(stepProduct(stepProduct(two, option, -ONE_UNIT), option, -ONE_UNIT)).toEqual([]);
    expect(stepProduct([], option, -ONE_UNIT)).toEqual([]);
  });

  it('una línea que ya venía rebajada conserva su precio al cambiar la cantidad', () => {
    const [pick] = productsFromTicket([{ ...wax, unitPrice: '2.50' }]);
    const next = stepProduct(pick === undefined ? [] : [pick], option, ONE_UNIT);

    expect(next[0]).toMatchObject({ unitPrice: '2.50', catalogPrice: '3.00', quantity: 3000 });
  });

  it('lo que queda cuenta lo que el lavado ya tenía apartado (RN-4)', () => {
    // Existencia 1 y el lavado ya tiene 2: se puede llegar a 3.
    expect(availableAfter('1.000', 2000, 2000)).toBe(1000);
    expect(availableAfter('1.000', 2000, 3000)).toBe(0);
    expect(availableAfter('3.000', 0, 0)).toBe(3000);
  });

  it('suma los productos al centavo', () => {
    expect(productsTotalCents(productsFromTicket([wax]))).toBe(600);
  });
});

describe('lo que viaja al API', () => {
  it('cantidad con tres decimales y sin precio si es el del catálogo', () => {
    expect(productItemsPayload(productsFromTicket([wax]))).toEqual([
      { inventoryItemId: 'inv-wax', quantity: '2.000' },
    ]);
  });

  it('manda el precio cuando la línea está rebajada', () => {
    expect(productItemsPayload(productsFromTicket([{ ...wax, unitPrice: '2.50' }]))).toEqual([
      { inventoryItemId: 'inv-wax', quantity: '2.000', unitPrice: '2.50' },
    ]);
  });

  it('la firma cambia con la cantidad y no con el orden', () => {
    const other = { ...wax, inventoryItemId: 'inv-air', id: 'l-3' };
    const a = productSignature(productsFromTicket([wax, other]));
    const b = productSignature(productsFromTicket([other, wax]));

    expect(a).toBe(b);
    expect(productSignature(productsFromTicket([{ ...wax, quantity: '3.000' }]))).not.toBe(
      productSignature(productsFromTicket([wax])),
    );
  });
});

describe('409 INSUFFICIENT_STOCK', () => {
  it('lee el faltante de los detalles', () => {
    expect(
      stockShortageOf({
        code: 'INSUFFICIENT_STOCK',
        details: { itemId: 'inv-wax', available: '1.000' },
      }),
    ).toEqual({ itemId: 'inv-wax', available: 1000 });
  });

  it('otro error, o detalles sin forma, no marcan nada', () => {
    expect(stockShortageOf({ code: 'ITEM_INACTIVE', details: { itemId: 'x' } })).toBeNull();
    expect(stockShortageOf({ code: 'INSUFFICIENT_STOCK' })).toBeNull();
    expect(stockShortageOf(null)).toBeNull();
  });

  it('se apaga solo al bajar la cantidad a lo que hay', () => {
    const shortage = { itemId: 'inv-wax', available: 1000 };
    const two = productsFromTicket([wax]);

    expect(activeShortage(shortage, two)).toEqual(shortage);
    expect(activeShortage(shortage, stepProduct(two, option, -ONE_UNIT))).toBeNull();
  });
});
