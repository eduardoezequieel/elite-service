import type { ComboOption, TicketItem } from '@elite/shared';

import {
  comboPriceFor,
  editComboChoices,
  editTicketPayload,
  groupTicketLines,
  intakeComboChoices,
  pickedCombos,
  standaloneItems,
  ticketComboIds,
  ticketItemLabels,
  toggleCombo,
} from './combo-lines';

const SEDAN = 'bt-sedan';
const SUV = 'bt-suv';

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
    comboId: null,
    comboName: null,
    ...overrides,
  };
}

const COMBO = { comboId: 'k-1', comboName: 'Combo verano' };

/** Un combo de $12 para sedán: lavado prorrateado + 2 ceras. */
const comboWash = item({ id: 'c-1', unitPrice: '7.20', total: '7.20', ...COMBO });
const comboWax = item({
  id: 'c-2',
  kind: 'PRODUCT',
  serviceId: null,
  inventoryItemId: 'inv-wax',
  name: 'Cera',
  catalogPrice: '3.00',
  unitPrice: '2.40',
  quantity: '2.000',
  total: '4.80',
  ...COMBO,
});
const looseVacuum = item({ id: 'l-2', serviceId: 's-2', name: 'Aspirado', total: '5.00' });
const looseAir = item({
  id: 'l-3',
  kind: 'PRODUCT',
  serviceId: null,
  inventoryItemId: 'inv-air',
  name: 'Aromatizante',
  quantity: '3.000',
  unitPrice: '1.00',
  total: '3.00',
});

function option(overrides: Partial<ComboOption> = {}): ComboOption {
  return {
    id: 'k-1',
    name: 'Combo verano',
    items: [
      { kind: 'SERVICE', name: 'Lavado completo', quantity: 1 },
      { kind: 'PRODUCT', name: 'Cera', quantity: 2 },
    ],
    prices: [
      { bodyTypeId: SEDAN, listPrice: '16.00', price: '12.00' },
      { bodyTypeId: SUV, listPrice: '20.00', price: '15.00' },
    ],
    outOfStock: [],
    ...overrides,
  };
}

describe('el precio del combo en el alta (104)', () => {
  it('es el del tipo de carro elegido', () => {
    expect(comboPriceFor(option().prices, SUV)).toBe('15.00');
    expect(comboPriceFor(option().prices, 'otro')).toBeNull();
  });

  it('sin tipo, el precio solo si todos dan igual', () => {
    expect(comboPriceFor(option().prices, '')).toBeNull();
    const flat = [
      { bodyTypeId: SEDAN, listPrice: '16.00', price: '12.00' },
      { bodyTypeId: SUV, listPrice: '16.00', price: '12' },
    ];
    expect(comboPriceFor(flat, '')).toBe('12.00');
    expect(comboPriceFor([], '')).toBeNull();
  });

  it('arma las tarjetas con lo que trae y el chip de lo que falta', () => {
    expect(intakeComboChoices([option({ outOfStock: ['Cera'] })], SEDAN)).toEqual([
      {
        id: 'k-1',
        name: 'Combo verano',
        detail: 'Lavado completo · Cera ×2',
        price: '12.00',
        missing: 'Sin cera',
      },
    ]);
  });

  it('solo viajan los elegidos que siguen siendo de hoy y con existencia', () => {
    const options = [option(), option({ id: 'k-2', outOfStock: ['Cera'] })];

    expect(pickedCombos(options, ['k-1', 'k-2', 'k-gone']).map((combo) => combo.id)).toEqual([
      'k-1',
    ]);
  });

  it('un combo va una sola vez: tocarlo de nuevo lo suelta', () => {
    expect(toggleCombo([], 'k-1')).toEqual(['k-1']);
    expect(toggleCombo(['k-1', 'k-2'], 'k-1')).toEqual(['k-2']);
  });
});

describe('leer un lavado con combos (104 criterio 9)', () => {
  it('agrupa las líneas del combo con su total, y lo suelto como siempre', () => {
    const grouped = groupTicketLines([comboWash, looseVacuum, comboWax, looseAir]);

    expect(grouped.combos).toEqual([
      { comboId: 'k-1', name: 'Combo verano', total: '12.00', items: [comboWash, comboWax] },
    ]);
    expect(grouped.services).toEqual([looseVacuum]);
    expect(grouped.products).toEqual([looseAir]);
  });

  it('sin combos no hay grupos', () => {
    expect(groupTicketLines([looseVacuum]).combos).toEqual([]);
  });

  it('en la lista el combo se nombra una vez, en su lugar', () => {
    expect(ticketItemLabels([comboWash, comboWax, looseVacuum, looseAir])).toEqual([
      'Combo verano',
      'Aspirado',
      'Aromatizante ×3',
    ]);
  });

  it('los combos del lavado, sin repetir, y las líneas sueltas', () => {
    expect(ticketComboIds([comboWash, looseVacuum, comboWax])).toEqual(['k-1']);
    expect(standaloneItems([comboWash, looseVacuum, comboWax, looseAir])).toEqual([
      looseVacuum,
      looseAir,
    ]);
  });
});

describe('editar un lavado con combos (104 criterio 8)', () => {
  const items = [comboWash, comboWax, looseVacuum];

  it('el combo del lavado conserva su precio guardado mientras no cambie el tipo', () => {
    const choices = editComboChoices({
      items,
      options: [option({ prices: [{ bodyTypeId: SEDAN, listPrice: '16.00', price: '11.00' }] })],
      bodyTypeId: SEDAN,
      savedBodyTypeId: SEDAN,
    });

    expect(choices).toEqual([
      {
        id: 'k-1',
        name: 'Combo verano',
        detail: 'Lavado completo · Cera ×2',
        price: '12.00',
        missing: null,
      },
    ]);
  });

  it('con otro tipo muestra el precio de hoy, y suma los combos de hoy que no tiene', () => {
    const choices = editComboChoices({
      items,
      options: [option(), option({ id: 'k-2', name: 'Combo full', outOfStock: ['Cera'] })],
      bodyTypeId: SUV,
      savedBodyTypeId: SEDAN,
    });

    expect(choices.map((choice) => [choice.id, choice.price, choice.missing])).toEqual([
      ['k-1', '15.00', null],
      ['k-2', '15.00', 'Sin cera'],
    ]);
  });

  it('un combo pausado que ya estaba sigue a la vista; con otro tipo, sin precio', () => {
    const choices = editComboChoices({
      items,
      options: [],
      bodyTypeId: SUV,
      savedBodyTypeId: SEDAN,
    });

    expect(choices.map((choice) => [choice.id, choice.price])).toEqual([['k-1', null]]);
  });

  it('manda lo suelto en items y la lista entera de combos', () => {
    expect(
      editTicketPayload({
        bodyTypeId: SUV,
        services: [{ id: 's-2', price: '5.00' }],
        products: [{ inventoryItemId: 'inv-air', quantity: '3.000' }],
        combos: ['k-1', 'k-2', 'k-1'],
        notes: 'Ojo con el retrovisor',
      }),
    ).toEqual({
      bodyTypeId: SUV,
      items: [
        { serviceId: 's-2', unitPrice: '5.00' },
        { inventoryItemId: 'inv-air', quantity: '3.000' },
      ],
      combos: [{ comboId: 'k-1' }, { comboId: 'k-2' }],
      notes: 'Ojo con el retrovisor',
    });
  });

  it('quitar todos los combos manda la lista vacía', () => {
    expect(
      editTicketPayload({ bodyTypeId: SEDAN, services: [], products: [], combos: [], notes: '' })
        .combos,
    ).toEqual([]);
  });
});
