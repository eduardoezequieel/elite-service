import {
  createInventoryAdjustmentSchema,
  createInventoryConsumptionSchema,
  createInventoryDispatchSchema,
  createInventoryEntrySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  type InventoryItem,
} from '@elite/shared';

import {
  EMPTY_ITEM_FORM,
  adjustmentDraft,
  consumptionDraft,
  createItemDraft,
  dispatchDraft,
  entryDraft,
  itemFormValuesOf,
  stockAfter,
  updateItemDraft,
} from './item-form';

const CATEGORY = '0b8a4a8e-4d2e-4f55-9d57-4a1d2b1c9e01';
const EMPLOYEE = '5f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f';

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

  it('el despacho exige empleado', () => {
    const empty = createInventoryDispatchSchema.safeParse(
      dispatchDraft({ quantity: '4', employeeId: '', note: '' }),
    );

    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.path).toEqual(['employeeId']);
    expect(
      createInventoryDispatchSchema.safeParse(
        dispatchDraft({ quantity: '4', employeeId: EMPLOYEE, note: 'Bahía 2' }),
      ).data,
    ).toEqual({ quantity: '4.000', employeeId: EMPLOYEE, note: 'Bahía 2' });
  });

  it('el consumo exige empleado y la nota vacía no viaja (070)', () => {
    const empty = createInventoryConsumptionSchema.safeParse(
      consumptionDraft({ quantity: '2', employeeId: '', note: '' }),
    );

    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.path).toEqual(['employeeId']);
    expect(
      createInventoryConsumptionSchema.safeParse(
        consumptionDraft({ quantity: '2', employeeId: EMPLOYEE, note: '  ' }),
      ).data,
    ).toEqual({ quantity: '2.000', employeeId: EMPLOYEE });
  });

  it('el ajuste pone el signo del selector y exige motivo (RN-12)', () => {
    expect(adjustmentDraft({ sign: 'remove', quantity: '3', reason: 'Conteo' }).quantity).toBe(
      '-3',
    );
    expect(adjustmentDraft({ sign: 'add', quantity: '-3', reason: 'Conteo' }).quantity).toBe('3');
    expect(
      createInventoryAdjustmentSchema.safeParse(
        adjustmentDraft({ sign: 'remove', quantity: '1', reason: '' }),
      ).success,
    ).toBe(false);
  });

  it('calcula la existencia que quedaría', () => {
    expect(stockAfter('2.000', '-3')).toBe(-1000);
    expect(stockAfter('2.000', '1.5')).toBe(3500);
    expect(stockAfter('2.000', '')).toBeNull();
  });
});
