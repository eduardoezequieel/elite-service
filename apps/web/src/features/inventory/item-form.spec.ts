import {
  createInventoryAdjustmentSchema,
  createInventoryEntrySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  type InventoryItem,
} from '@elite/shared';

import {
  EMPTY_ITEM_FORM,
  countAdjustmentDraft,
  countDifference,
  createItemDraft,
  entryDraft,
  itemFormValuesOf,
  stockAfter,
  updateItemDraft,
} from './item-form';

const CATEGORY = '0b8a4a8e-4d2e-4f55-9d57-4a1d2b1c9e01';

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'i-1',
    code: 'INV-0001',
    barcode: null,
    name: 'Cera en pasta',
    kind: 'PRODUCT',
    category: { id: CATEGORY, name: 'Ceras' },
    unit: 'unidad',
    price: '3.00',
    taxRate: '0.1300',
    averageCost: '1.50',
    stockOnHand: '4.000',
    minStock: '5.000',
    isLowStock: true,
    isActive: true,
    createdAt: '2026-09-26T15:00:00.000Z',
    updatedAt: '2026-09-26T15:00:00.000Z',
    ...overrides,
  };
}

describe('alta de artículo (065 RN-1)', () => {
  it('un producto manda precio y pasa el schema del API', () => {
    const draft = createItemDraft({
      ...EMPTY_ITEM_FORM,
      name: 'Aromatizante',
      price: '3.5',
      minStock: '5',
      categoryId: CATEGORY,
    });
    const parsed = createInventoryItemSchema.safeParse(draft);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ price: '3.50', minStock: '5.000', categoryId: CATEGORY });
  });

  it('un insumo no manda precio aunque el campo tenga algo', () => {
    const draft = createItemDraft({
      ...EMPTY_ITEM_FORM,
      kind: 'SUPPLY',
      name: 'Franela',
      price: '9.99',
    });

    expect(draft).not.toHaveProperty('price');
    expect(createInventoryItemSchema.safeParse(draft).success).toBe(true);
  });

  it('un producto sin precio falla en el campo precio', () => {
    const parsed = createInventoryItemSchema.safeParse(
      createItemDraft({ ...EMPTY_ITEM_FORM, name: 'Cera', price: '' }),
    );

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['price']);
  });

  it('los opcionales vacíos no viajan', () => {
    const draft = createItemDraft({ ...EMPTY_ITEM_FORM, kind: 'SUPPLY', name: 'Guantes' });

    expect(Object.keys(draft).sort()).toEqual(['kind', 'name', 'unit']);
  });
});

describe('edición de artículo', () => {
  it('parte de lo guardado, sin ceros de más', () => {
    expect(itemFormValuesOf(item())).toMatchObject({
      categoryId: CATEGORY,
      price: '3.00',
      minStock: '5',
      barcode: '',
    });
    expect(
      itemFormValuesOf(item({ kind: 'SUPPLY', price: '0.00', minStock: '0.000' })),
    ).toMatchObject({ price: '', minStock: '' });
  });

  it('vaciar categoría y código los quita; el tipo no viaja', () => {
    const draft = updateItemDraft({ ...itemFormValuesOf(item()), categoryId: '', barcode: '' });

    expect(draft.categoryId).toBeNull();
    expect(draft.barcode).toBeNull();
    expect(draft).not.toHaveProperty('kind');
    expect(updateInventoryItemSchema.safeParse(draft).success).toBe(true);
  });

  it('un insumo editado no manda precio y el mínimo vacío es cero', () => {
    const draft = updateItemDraft({
      ...itemFormValuesOf(item({ kind: 'SUPPLY', price: '0.00' })),
      minStock: '',
    });

    expect(draft).not.toHaveProperty('price');
    expect(draft.minStock).toBe('0');
  });
});

describe('movimientos', () => {
  it('la entrada manda costo y referencia solo si hay', () => {
    expect(entryDraft({ quantity: '3', unitCost: '', reference: ' ' })).toEqual({ quantity: '3' });
    expect(
      createInventoryEntrySchema.safeParse(
        entryDraft({ quantity: '3', unitCost: '2.5', reference: 'Factura 1' }),
      ).data,
    ).toEqual({ quantity: '3.000', unitCost: '2.50', reference: 'Factura 1' });
  });

  it('el conteo manda la diferencia con signo: falta, sobra o cuadra (091 RN-5)', () => {
    expect(countDifference('7.000', '5')).toBe(-2000);
    expect(countDifference('7.000', '9.5')).toBe(2500);
    expect(countDifference('7.000', '7')).toBe(0);
    expect(countDifference('7.000', '')).toBeNull();
    expect(countDifference('7.000', '-1')).toBeNull();
    expect(countAdjustmentDraft('7.000', { counted: '5', reason: 'Conteo' })).toEqual({
      quantity: '-2.000',
      reason: 'Conteo',
    });
  });

  it('un conteo que cuadra o sin motivo no pasa el schema del ajuste (RN-12)', () => {
    expect(
      createInventoryAdjustmentSchema.safeParse(
        countAdjustmentDraft('7.000', { counted: '7', reason: 'Conteo' }),
      ).success,
    ).toBe(false);
    expect(
      createInventoryAdjustmentSchema.safeParse(
        countAdjustmentDraft('7.000', { counted: '6', reason: '' }),
      ).success,
    ).toBe(false);
    expect(
      createInventoryAdjustmentSchema.safeParse(
        countAdjustmentDraft('7.000', { counted: '6', reason: 'Conteo del viernes' }),
      ).data,
    ).toEqual({ quantity: '-1.000', reason: 'Conteo del viernes' });
  });

  it('calcula la existencia que quedaría', () => {
    expect(stockAfter('2.000', '-3')).toBe(-1000);
    expect(stockAfter('2.000', '1.5')).toBe(3500);
    expect(stockAfter('2.000', '')).toBeNull();
  });
});
