import type { InventoryItemOption, PriceAuthorizationInput } from '@elite/shared';

import type { PaymentLine } from '../carwash/charge-math';
import {
  applyStockConflict,
  buildChargeInput,
  canAddOne,
  cartTotalCents,
  formulaLabel,
  insufficientStockOf,
  isOverStock,
  isVoidReady,
  productsBlocker,
  lineFromOption,
  lineTotalCents,
  maskQuantityInput,
  needsPriceAuthorization,
  removeLine,
  saleBlocker,
  setQuantity,
  setUnitPrice,
  stepCart,
  syncStock,
  toMilli,
  type CartLine,
} from './sale-cart';

const WAX: InventoryItemOption = {
  id: 'wax',
  code: 'INV-0001',
  name: 'Cera en pasta',
  price: '7.00',
  unit: 'unidad',
  stockOnHand: '3.000',
};

const SHAMPOO: InventoryItemOption = {
  id: 'shampoo',
  code: 'INV-0002',
  name: 'Shampoo',
  price: '3.00',
  unit: 'litro',
  stockOnHand: '2.500',
};

const EMPTY: InventoryItemOption = {
  id: 'empty',
  code: 'INV-0003',
  name: 'Aromatizante',
  price: '2.00',
  unit: 'unidad',
  stockOnHand: '0.000',
};

function line(overrides: Partial<CartLine> = {}): CartLine {
  return { ...lineFromOption(WAX), ...overrides };
}

const SIGNED: PriceAuthorizationInput = {
  reason: 'Cliente frecuente',
  authorization: { email: ' ana@taller.sv ', password: 'secreta' },
};

describe('cantidades en milésimas (065 RN-16)', () => {
  it('lee cadenas con hasta tres decimales, con punto o coma', () => {
    expect(toMilli('2')).toBe(2000);
    expect(toMilli('2.5')).toBe(2500);
    expect(toMilli('2,125')).toBe(2125);
    expect(toMilli('0.001')).toBe(1);
    expect(toMilli('.5')).toBe(500);
    expect(toMilli('3.000')).toBe(3000);
  });

  it('lo ilegible o vacío es cero', () => {
    expect(toMilli('')).toBe(0);
    expect(toMilli('abc')).toBe(0);
    expect(toMilli('-2')).toBe(0);
  });

  it('la máscara del campo deja tres decimales y cambia la coma', () => {
    expect(maskQuantityInput('2,5')).toBe('2.5');
    expect(maskQuantityInput('1.23456')).toBe('1.234');
    expect(maskQuantityInput('a1b')).toBe('1');
  });
});

describe('líneas y total', () => {
  it('2 × $3.00 = $6.00', () => {
    const shampoo = { unitPrice: '3.00', quantity: 2000 };

    expect(lineTotalCents(shampoo)).toBe(600);
    expect(formulaLabel(shampoo)).toBe('2 × $3.00 = $6.00');
  });

  it('una cantidad fraccionaria redondea al centavo, la mitad hacia arriba', () => {
    // 1.5 × $3.33 = 4.995 → $5.00
    expect(lineTotalCents({ unitPrice: '3.33', quantity: 1500 })).toBe(500);
    expect(formulaLabel({ unitPrice: '3.33', quantity: 1500 })).toBe('1.5 × $3.33 = $5.00');
  });

  it('el total suma las líneas en centavos', () => {
    const lines = [line({ quantity: 2000 }), lineFromOption(SHAMPOO)];

    expect(cartTotalCents(lines)).toBe(1400 + 300);
    expect(cartTotalCents([])).toBe(0);
  });
});

describe('el − + y «Hay N»', () => {
  it('el + agrega el producto con una unidad al precio del catálogo', () => {
    const [added] = stepCart([], WAX, 1);

    expect(added).toMatchObject({ itemId: 'wax', quantity: 1000, unitPrice: '7.00', stock: 3000 });
  });

  it('sin existencia no se agrega', () => {
    expect(stepCart([], EMPTY, 1)).toEqual([]);
  });

  it('con menos de una unidad, el + agrega lo que hay', () => {
    const [added] = stepCart([], { ...SHAMPOO, stockOnHand: '0.500' }, 1);

    expect(added?.quantity).toBe(500);
  });

  it('el + nunca pasa de lo que hay', () => {
    let lines = stepCart([], WAX, 1);
    lines = stepCart(lines, WAX, 1);
    lines = stepCart(lines, WAX, 1);

    expect(lines[0]?.quantity).toBe(3000);
    expect(canAddOne(lines[0] ?? line())).toBe(false);
    expect(stepCart(lines, WAX, 1)[0]?.quantity).toBe(3000);
  });

  it('el − hasta cero quita la línea', () => {
    const lines = stepCart([], WAX, 1);

    expect(stepCart(lines, WAX, -1)).toEqual([]);
    expect(stepCart([], WAX, -1)).toEqual([]);
  });

  it('teclear la cantidad la recorta a lo que hay y cero la quita', () => {
    const lines = [line()];

    expect(setQuantity(lines, 'wax', 2500)[0]?.quantity).toBe(2500);
    expect(setQuantity(lines, 'wax', 9000)[0]?.quantity).toBe(3000);
    expect(setQuantity(lines, 'wax', 0)).toEqual([]);
  });

  it('quitar deja las demás líneas', () => {
    const lines = [line(), lineFromOption(SHAMPOO)];

    expect(removeLine(lines, 'wax').map((row) => row.itemId)).toEqual(['shampoo']);
  });

  it('pone al día «Hay N» sin tocar la cantidad', () => {
    const lines = [line({ quantity: 3000 })];
    const synced = syncStock(lines, [{ ...WAX, stockOnHand: '1.000' }]);

    expect(synced[0]).toMatchObject({ quantity: 3000, stock: 1000 });
    expect(isOverStock(synced[0] ?? line())).toBe(true);
  });

  it('un 409 INSUFFICIENT_STOCK se lee y se anota en su línea', () => {
    const conflict = insufficientStockOf('INSUFFICIENT_STOCK', {
      itemId: 'wax',
      available: '1.000',
    });

    expect(conflict).toEqual({ itemId: 'wax', available: 1000 });
    expect(
      applyStockConflict([line({ quantity: 2000 })], conflict ?? { itemId: '', available: 0 })[0],
    ).toMatchObject({ quantity: 2000, stock: 1000 });
  });

  it('otro error o details raros no son un conflicto de existencia', () => {
    expect(insufficientStockOf('CASH_NOT_OPEN', { itemId: 'wax', available: '1.000' })).toBeNull();
    expect(insufficientStockOf('INSUFFICIENT_STOCK', null)).toBeNull();
    expect(insufficientStockOf('INSUFFICIENT_STOCK', { available: '1.000' })).toBeNull();
  });
});

describe('el candado del precio (060, RN-21)', () => {
  it('el precio nunca pasa del catálogo ni baja de cero', () => {
    expect(setUnitPrice([line()], 'wax', '9.00')[0]?.unitPrice).toBe('7.00');
    expect(setUnitPrice([line()], 'wax', '5.5')[0]?.unitPrice).toBe('5.50');
    expect(setUnitPrice([line()], 'wax', '-1')[0]?.unitPrice).toBe('0.00');
  });

  it('pide firma solo si alguna línea baja del catálogo', () => {
    expect(needsPriceAuthorization([line()])).toBe(false);
    expect(needsPriceAuthorization([line({ unitPrice: '6.00' })])).toBe(true);
  });
});

describe('por qué no se puede cobrar', () => {
  const base = {
    cashClosed: false,
    lines: [line({ quantity: 2000 })],
    priceAuthorization: null,
    split: false,
    payments: [] as PaymentLine[],
    tendered: '',
    cashDue: 1400,
  };

  it('en el orden de la pantalla', () => {
    expect(saleBlocker({ ...base, cashClosed: true })).toBe('Sin turno abierto');
    expect(saleBlocker({ ...base, lines: [] })).toBe('Agregá un producto');
    expect(saleBlocker({ ...base, lines: [line({ quantity: 2000, stock: 1000 })] })).toBe(
      'Hay 1 de Cera en pasta',
    );
    expect(saleBlocker({ ...base, lines: [line({ unitPrice: '6.00' })] })).toBe(
      'Falta autorizar el precio',
    );
  });

  it('con la firma completa pasa al pago', () => {
    expect(
      saleBlocker({ ...base, lines: [line({ unitPrice: '6.00' })], priceAuthorization: SIGNED }),
    ).toBeNull();
    expect(
      saleBlocker({
        ...base,
        lines: [line({ unitPrice: '6.00' })],
        priceAuthorization: { ...SIGNED, reason: 'no' },
      }),
    ).toBe('Falta autorizar el precio');
  });

  it('usa las reglas del pago de la 059', () => {
    expect(saleBlocker(base)).toBeNull();
    expect(saleBlocker({ ...base, tendered: '10.00' })).toBe('Falta efectivo');
    expect(
      saleBlocker({
        ...base,
        split: true,
        payments: [{ id: 'a', method: 'CASH', amount: '10.00' }],
        cashDue: 1000,
      }),
    ).toBe('Falta $4.00');
  });
});

describe('el cuerpo de POST /carwash/charges (066)', () => {
  const pay = {
    customerName: '  ',
    split: false,
    method: 'CARD' as const,
    payments: [] as PaymentLine[],
    tendered: '',
    cashDue: 0,
  };

  it('una venta sin lavados: un pago al total, sin precio ni firma si nada bajó', () => {
    const body = buildChargeInput({
      ...pay,
      workOrderIds: [],
      lines: [line({ quantity: 2000 }), lineFromOption(SHAMPOO)],
      totalCents: 1700,
      priceAuthorization: SIGNED,
    });

    expect(body).toEqual({
      workOrderIds: [],
      products: [
        { inventoryItemId: 'wax', quantity: '2.000' },
        { inventoryItemId: 'shampoo', quantity: '1.000' },
      ],
      payments: [{ method: 'CARD', amount: '17.00' }],
    });
  });

  it('lavados y productos: el pago único es el total de la cuenta', () => {
    const body = buildChargeInput({
      ...pay,
      workOrderIds: ['t1', 't2'],
      lines: [lineFromOption(SHAMPOO)],
      totalCents: 2700,
      priceAuthorization: null,
    });

    expect(body).toEqual({
      workOrderIds: ['t1', 't2'],
      products: [{ inventoryItemId: 'shampoo', quantity: '1.000' }],
      payments: [{ method: 'CARD', amount: '27.00' }],
    });
  });

  it('solo lavados: sin productos ni nombre, como el cobro de la 059', () => {
    const body = buildChargeInput({
      ...pay,
      customerName: 'Juan',
      workOrderIds: ['t1'],
      lines: [],
      totalCents: 1400,
      priceAuthorization: SIGNED,
    });

    expect(body).toEqual({
      workOrderIds: ['t1'],
      payments: [{ method: 'CARD', amount: '14.00' }],
    });
  });

  it('pago partido, efectivo entregado, precio rebajado y su firma', () => {
    const body = buildChargeInput({
      workOrderIds: [],
      lines: [line({ quantity: 2000, unitPrice: '6.00' })],
      customerName: ' Juan Pérez ',
      split: true,
      method: 'CASH',
      payments: [
        { id: 'a', method: 'CARD', amount: '5' },
        { id: 'b', method: 'CASH', amount: '7.00' },
      ],
      tendered: '10',
      cashDue: 700,
      totalCents: 1200,
      priceAuthorization: SIGNED,
    });

    expect(body).toEqual({
      workOrderIds: [],
      customerName: 'Juan Pérez',
      products: [{ inventoryItemId: 'wax', quantity: '2.000', unitPrice: '6.00' }],
      payments: [
        { method: 'CARD', amount: '5.00' },
        { method: 'CASH', amount: '7.00' },
      ],
      cashTendered: '10.00',
      priceAuthorization: {
        reason: 'Cliente frecuente',
        authorization: { email: 'ana@taller.sv', password: 'secreta' },
      },
    });
  });
});

describe('los datos del método en el cobro (069)', () => {
  const base = {
    workOrderIds: ['t1'],
    lines: [],
    customerName: '',
    tendered: '',
    cashDue: 0,
    totalCents: 4000,
    priceAuthorization: null,
  };

  it('el pago único por transferencia lleva cuenta y referencia', () => {
    const body = buildChargeInput({
      ...base,
      split: false,
      method: 'TRANSFER',
      details: { bankAccountId: 'acc-1', reference: ' 998877 ', description: 'no va' },
      payments: [],
    });

    expect(body.payments).toEqual([
      { method: 'TRANSFER', amount: '40.00', bankAccountId: 'acc-1', reference: '998877' },
    ]);
  });

  it('en el pago partido cada renglón lleva lo suyo y nada de otro método', () => {
    const body = buildChargeInput({
      ...base,
      split: true,
      method: 'CASH',
      payments: [
        { id: 'a', method: 'OTHER', amount: '5', description: 'cheque', reference: 'x' },
        { id: 'b', method: 'CARD', amount: '35.00', bankAccountId: 'acc-1' },
      ],
    });

    expect(body.payments).toEqual([
      { method: 'OTHER', amount: '5.00', description: 'cheque' },
      { method: 'CARD', amount: '35.00' },
    ]);
  });
});

describe('los productos sueltos en el cobro del lavado (066)', () => {
  it('sin productos no bloquean nada', () => {
    expect(productsBlocker([], null)).toBeNull();
  });

  it('existencia y firma, igual que en la venta', () => {
    expect(productsBlocker([line({ quantity: 2000, stock: 1000 })], null)).toBe(
      'Hay 1 de Cera en pasta',
    );
    expect(productsBlocker([line({ unitPrice: '6.00' })], null)).toBe('Falta autorizar el precio');
    expect(productsBlocker([line({ unitPrice: '6.00' })], SIGNED)).toBeNull();
  });

  it('la venta con lavados suma los lavados al total del pago', () => {
    expect(
      saleBlocker({
        cashClosed: false,
        lines: [line()],
        priceAuthorization: null,
        split: true,
        payments: [{ id: 'a', method: 'CARD', amount: '7.00' }],
        tendered: '',
        cashDue: 0,
        ticketsCents: 1400,
      }),
    ).toBe('Falta $14.00');
  });
});

describe('anular la venta (RN-22)', () => {
  it('pide motivo y credenciales', () => {
    expect(isVoidReady('Devolvió sin abrir', { email: 'a@b.sv', password: 'x' })).toBe(true);
    expect(isVoidReady('no', { email: 'a@b.sv', password: 'x' })).toBe(false);
    expect(isVoidReady('Devolvió sin abrir', { email: ' ', password: 'x' })).toBe(false);
  });
});
