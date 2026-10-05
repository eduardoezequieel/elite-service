import type { ComboDetail, ServiceDetail } from '@elite/shared';

import {
  addPick,
  comboApiErrors,
  comboFormOf,
  comboFormSchema,
  comboInputOf,
  comboPayloadOf,
  emptyComboForm,
  fixedPriceIssue,
  hasPick,
  listSumCents,
  listSums,
  maskPercent,
  parsePercent,
  percentPriceCents,
  removePick,
  sameSums,
  stepPickQuantity,
  type ComboFormValues,
  type ComboPick,
} from './combo-draft';

const TODAY = '2026-10-05';
const SEDAN = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a04';
const SUV = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a05';
const WASH = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a01';
const VACUUM = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a02';
const WAX = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a03';

function service(id: string, defaultPrice: string, prices: ServiceDetail['prices'] = []) {
  return {
    id,
    code: 'LAV-01',
    name: 'Servicio',
    category: { id: 'cat', name: 'Lavado', sortOrder: 1, isActive: true },
    defaultPrice,
    taxRate: '0.13',
    isActive: true,
    prices,
  } as ServiceDetail;
}

/** Lavado: $10 sedán, $14 camioneta. Aspirado: $5 parejo. Cera: $3. */
const SERVICES = [
  service(WASH, '10.00', [{ bodyTypeId: SUV, price: '14.00' }]),
  service(VACUUM, '5.00'),
];
const PRODUCT_PRICES = { [WAX]: '3.00' };

const picks: ComboPick[] = [
  { kind: 'SERVICE', id: WASH, name: 'Lavado' },
  { kind: 'PRODUCT', id: WAX, name: 'Cera', quantity: 2 },
];

function form(overrides: Partial<ComboFormValues> = {}): ComboFormValues {
  return {
    ...emptyComboForm(TODAY),
    name: 'Combo verano',
    items: picks,
    prices: { [SEDAN]: '12', [SUV]: '15.50' },
    ...overrides,
  };
}

const context = {
  bodyTypeIds: [SEDAN, SUV],
  sums: listSums(picks, [SEDAN, SUV], SERVICES, PRODUCT_PRICES),
};

function issues(values: ComboFormValues): Record<string, string> {
  const result = comboFormSchema(context).safeParse(values);
  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('los componentes del combo (104 RN-1)', () => {
  it('un servicio o producto entra una sola vez; el producto con 1', () => {
    const once = addPick([], { kind: 'PRODUCT', id: WAX, name: 'Cera' });
    expect(once).toEqual([{ kind: 'PRODUCT', id: WAX, name: 'Cera', quantity: 1 }]);
    expect(addPick(once, { kind: 'PRODUCT', id: WAX, name: 'Cera' })).toEqual(once);
    expect(hasPick(once, 'PRODUCT', WAX)).toBe(true);
    expect(hasPick(once, 'SERVICE', WAX)).toBe(false);
  });

  it('la cantidad va de 1 a 10 y quitar saca solo ese', () => {
    expect(stepPickQuantity(picks, 1, 1)[1]).toMatchObject({ quantity: 3 });
    expect(stepPickQuantity(picks, 1, -5)[1]).toMatchObject({ quantity: 1 });
    expect(stepPickQuantity([{ ...picks[1], quantity: 10 } as ComboPick], 0, 1)[0]).toMatchObject({
      quantity: 10,
    });
    expect(stepPickQuantity(picks, 0, 1)).toEqual(picks);
    expect(removePick(picks, 0)).toEqual([picks[1]]);
  });
});

describe('el precio del combo (104 RN-2, criterio 2)', () => {
  it('suma por separado con la matriz del servicio y precio × cantidad', () => {
    expect(listSumCents(picks, SEDAN, SERVICES, PRODUCT_PRICES)).toBe(1000 + 600);
    expect(listSumCents(picks, SUV, SERVICES, PRODUCT_PRICES)).toBe(1400 + 600);
    expect(listSumCents(picks, SEDAN, [], PRODUCT_PRICES)).toBeNull();
    expect(listSumCents(picks, SEDAN, SERVICES, {})).toBeNull();
  });

  it('un solo precio cuando todos los tipos suman igual', () => {
    expect(sameSums(context.sums)).toBe(false);
    const flat = listSums(
      [{ kind: 'SERVICE', id: VACUUM, name: 'Aspirado' }, picks[1]],
      [SEDAN, SUV],
      SERVICES,
      PRODUCT_PRICES,
    );
    expect(flat).toEqual({ [SEDAN]: 1100, [SUV]: 1100 });
    expect(sameSums(flat)).toBe(true);
    expect(sameSums({})).toBe(false);
  });

  it('el descuento redondea al centavo con la mitad hacia arriba', () => {
    expect(percentPriceCents(1600, 10)).toBe(1440);
    expect(percentPriceCents(1250, 15)).toBe(1063);
    expect(percentPriceCents(999, 50)).toBe(500);
  });

  it('el descuento se teclea entero', () => {
    expect(maskPercent('1a5%9')).toBe('15');
    expect(parsePercent(' 15 ')).toBe(15);
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('1.5')).toBeNaN();
  });

  it('el precio fijo tiene que ahorrar algo', () => {
    expect(fixedPriceIssue('', 1600)).toBe('Falta el precio');
    expect(fixedPriceIssue('abc', 1600)).toBe('Monto inválido');
    expect(fixedPriceIssue('0', 1600)).toBe('Mayor que cero');
    expect(fixedPriceIssue('16', 1600)).toBe('Sin ahorro');
    expect(fixedPriceIssue('15,99', 1600)).toBeNull();
    expect(fixedPriceIssue('99', null)).toBeNull();
  });
});

describe('el formulario del editor (104)', () => {
  it('un combo bien armado no tiene errores y viaja normalizado', () => {
    expect(issues(form())).toEqual({});
    expect(comboInputOf(form(), [SEDAN, SUV])).toEqual({
      name: 'Combo verano',
      items: [{ serviceId: WASH }, { inventoryItemId: WAX, quantity: 2 }],
      pricingMode: 'FIXED',
      discountPercent: null,
      prices: [
        { bodyTypeId: SEDAN, price: '12.00' },
        { bodyTypeId: SUV, price: '15.50' },
      ],
      validFrom: TODAY,
      validTo: null,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      isActive: true,
    });
  });

  it('con descuento no manda precios, y «Hasta» solo sin «Sin fin»', () => {
    const payload = comboPayloadOf(
      form({
        pricingMode: 'PERCENT',
        discountPercent: '15',
        noEnd: false,
        validTo: '2026-12-31',
        weekdays: [6, 0],
      }),
      [SEDAN, SUV],
    );

    expect(payload).toMatchObject({
      pricingMode: 'PERCENT',
      discountPercent: 15,
      prices: [],
      validTo: '2026-12-31',
      weekdays: [0, 6],
    });
    expect(comboPayloadOf(form({ noEnd: true, validTo: '2026-12-31' }), []).validTo).toBeNull();
  });

  it('pinta cada error del schema compartido en su campo, corto', () => {
    expect(issues(form({ name: ' ', items: [picks[0]], weekdays: [] }))).toEqual({
      name: 'Falta el nombre',
      items: 'Mínimo dos cosas',
      weekdays: 'Elegí un día',
    });
    expect(issues(form({ items: [picks[1], { ...picks[1], id: VACUUM }] }))).toMatchObject({
      items: 'Falta un servicio',
    });
    expect(issues(form({ pricingMode: 'PERCENT', discountPercent: '' }))).toEqual({
      discountPercent: 'Falta el descuento',
    });
    expect(issues(form({ noEnd: false, validTo: '2026-10-01' }))).toEqual({
      validTo: 'Antes del inicio',
    });
  });

  it('el precio fijo de cada tipo, con su error', () => {
    expect(issues(form({ prices: { [SEDAN]: '16.00', [SUV]: '' } }))).toEqual({
      [`prices.${SEDAN}`]: 'Sin ahorro',
      [`prices.${SUV}`]: 'Falta el precio',
    });
  });
});

describe('editar y duplicar (104)', () => {
  const combo: ComboDetail = {
    id: 'k-1',
    code: 'CMB-0001',
    name: 'Combo verano',
    pricingMode: 'FIXED',
    discountPercent: null,
    validFrom: '2026-10-01',
    validTo: '2026-12-31',
    weekdays: [0, 6],
    isActive: true,
    status: 'LIVE',
    items: [
      {
        kind: 'SERVICE',
        serviceId: WASH,
        inventoryItemId: null,
        code: 'LAV-01',
        name: 'Lavado',
        quantity: 1,
        stockOnHand: null,
      },
      {
        kind: 'PRODUCT',
        serviceId: null,
        inventoryItemId: WAX,
        code: 'INV-0001',
        name: 'Cera',
        quantity: 2,
        stockOnHand: '8.000',
      },
    ],
    prices: [
      { bodyTypeId: SEDAN, listPrice: '16.00', price: '12.00' },
      { bodyTypeId: SUV, listPrice: '20.00', price: '15.50' },
    ],
    outOfStock: [],
  };

  it('editar trae el combo tal cual', () => {
    expect(comboFormOf(combo, 'edit')).toEqual({
      name: 'Combo verano',
      items: picks.map((pick) => (pick.kind === 'SERVICE' ? pick : { ...pick })),
      pricingMode: 'FIXED',
      discountPercent: '10',
      prices: { [SEDAN]: '12.00', [SUV]: '15.50' },
      validFrom: '2026-10-01',
      validTo: '2026-12-31',
      noEnd: false,
      weekdays: [0, 6],
      isActive: true,
    });
  });

  it('duplicar suma «(copia)» y lo deja pausado', () => {
    expect(comboFormOf(combo, 'duplicate')).toMatchObject({
      name: 'Combo verano (copia)',
      isActive: false,
    });
  });

  it('con descuento no trae precios fijos', () => {
    expect(
      comboFormOf({ ...combo, pricingMode: 'PERCENT', discountPercent: 20, validTo: null }, 'edit'),
    ).toMatchObject({ discountPercent: '20', prices: {}, noEnd: true, validTo: '' });
  });
});

describe('los errores del API (104)', () => {
  it('el nombre repetido va al nombre', () => {
    expect(comboApiErrors({ code: 'COMBO_NAME_TAKEN', message: 'Ya hay uno' }, [SEDAN])).toEqual({
      fields: [['name', 'Ya existe']],
      general: null,
    });
  });

  it('una regla de la base marca su campo, o el precio de cada tipo de carro nombrado', () => {
    expect(
      comboApiErrors(
        {
          code: 'VALIDATION_ERROR',
          message: 'Menor que separado',
          details: { field: 'prices', bodyTypeIds: [SUV] },
        },
        [SEDAN, SUV],
      ),
    ).toEqual({ fields: [[`prices.${SUV}`, 'Menor que separado']], general: null });
    expect(
      comboApiErrors(
        { code: 'VALIDATION_ERROR', message: 'Antes del inicio', details: { field: 'validTo' } },
        [SEDAN],
      ),
    ).toEqual({ fields: [['validTo', 'Antes del inicio']], general: null });
  });

  it('cada detalle a su campo; el precio N es el tipo de carro N', () => {
    expect(
      comboApiErrors(
        {
          code: 'VALIDATION_ERROR',
          message: 'Revisá los datos',
          details: { 'prices.1.price': 'Sin ahorro', 'items.0': 'Inactivo', 'weekdays.2': 'Día' },
        },
        [SEDAN, SUV],
      ),
    ).toEqual({
      fields: [
        [`prices.${SUV}`, 'Sin ahorro'],
        ['items', 'Inactivo'],
        ['weekdays', 'Día'],
      ],
      general: null,
    });
  });

  it('lo que no cae en un campo sale al pie', () => {
    expect(comboApiErrors({ code: 'INTERNAL', message: 'Falló' }, [SEDAN])).toEqual({
      fields: [],
      general: 'Falló',
    });
    expect(
      comboApiErrors({ code: 'VALIDATION_ERROR', message: 'Revisá', details: { _: 'x' } }, [SEDAN]),
    ).toEqual({ fields: [], general: 'Revisá' });
  });
});
