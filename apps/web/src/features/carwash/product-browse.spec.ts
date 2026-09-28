import type { InventoryItemOption } from '@elite/shared';

import {
  UNCATEGORIZED_KEY,
  UNCATEGORIZED_LABEL,
  categoryChips,
  categoryKeyOf,
  groupByCategory,
  optionsInCategory,
} from './product-browse';
import type { ProductPick } from './product-lines';

const SCENTS = { id: 'cat-scents', name: 'Aromatizantes' };
const WAXES = { id: 'cat-waxes', name: 'Ceras y pulidores' };

function option(
  id: string,
  name: string,
  category: InventoryItemOption['category'],
): InventoryItemOption {
  return {
    id,
    code: `INV-${id}`,
    name,
    price: '3.00',
    unit: 'unidad',
    stockOnHand: '5.000',
    category,
  };
}

function pick(inventoryItemId: string, quantity: number): ProductPick {
  return {
    inventoryItemId,
    name: inventoryItemId,
    catalogPrice: '3.00',
    unitPrice: '3.00',
    quantity,
  };
}

const OPTIONS: InventoryItemOption[] = [
  option('wax', 'Cera líquida', WAXES),
  option('rag', 'Franela', null),
  option('pine', 'Aromatizante pino', SCENTS),
  option('paste', 'Cera en pasta', WAXES),
  option('new-car', 'Aromatizante carro nuevo', SCENTS),
];

describe('categoryKeyOf', () => {
  it('usa el id de la categoría, o la clave de «Sin categoría»', () => {
    expect(categoryKeyOf({ category: WAXES })).toBe('cat-waxes');
    expect(categoryKeyOf({ category: null })).toBe(UNCATEGORIZED_KEY);
  });
});

describe('groupByCategory', () => {
  it('agrupa alfabético por categoría, «Sin categoría» al final y cada grupo por nombre (RN-3)', () => {
    const groups = groupByCategory(OPTIONS);

    expect(groups.map((group) => group.name)).toEqual([
      'Aromatizantes',
      'Ceras y pulidores',
      UNCATEGORIZED_LABEL,
    ]);
    expect(groups[0]?.options.map((o) => o.id)).toEqual(['new-car', 'pine']);
    expect(groups[1]?.options.map((o) => o.id)).toEqual(['paste', 'wax']);
    expect(groups[2]?.options.map((o) => o.id)).toEqual(['rag']);
  });

  it('una categoría que empieza con «S» igual va antes de «Sin categoría»', () => {
    const groups = groupByCategory([
      option('a', 'Algo', null),
      option('b', 'Shampoo', { id: 'cat-z', name: 'Shampoos' }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['cat-z', UNCATEGORIZED_KEY]);
  });

  it('sin productos, sin grupos', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe('categoryChips', () => {
  it('cuenta los productos de cada chip y suma lo elegido de cada uno (RN-2)', () => {
    const chips = categoryChips(OPTIONS, [pick('wax', 2000), pick('paste', 1000)]);

    expect(chips).toEqual([
      { key: 'cat-scents', name: 'Aromatizantes', total: 2, picked: 0 },
      { key: 'cat-waxes', name: 'Ceras y pulidores', total: 2, picked: 3000 },
      { key: UNCATEGORIZED_KEY, name: UNCATEGORIZED_LABEL, total: 1, picked: 0 },
    ]);
  });

  it('un elegido que ya no está a la venta no suma a ningún chip', () => {
    const chips = categoryChips(OPTIONS, [pick('gone', 4000)]);

    expect(chips.every((chip) => chip.picked === 0)).toBe(true);
  });
});

describe('optionsInCategory', () => {
  it('trae solo los de ese chip, por nombre', () => {
    expect(optionsInCategory(OPTIONS, 'cat-scents').map((o) => o.id)).toEqual(['new-car', 'pine']);
    expect(optionsInCategory(OPTIONS, UNCATEGORIZED_KEY).map((o) => o.id)).toEqual(['rag']);
    expect(optionsInCategory(OPTIONS, 'cat-unknown')).toEqual([]);
  });
});
