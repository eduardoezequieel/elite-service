import type { InventoryItem } from '@elite/shared';

import { itemDefinitionRow } from './item-definitions';

const BASE: InventoryItem = {
  id: 'i1',
  code: 'INV-0012',
  barcode: null,
  name: 'Cera en pasta',
  kind: 'PRODUCT',
  category: { id: 'c1', name: 'Ceras' },
  unit: ' unidad ',
  price: '14.00',
  taxRate: '0.13',
  averageCost: '9.50',
  stockOnHand: '4.000',
  minStock: '2.500',
  isLowStock: false,
  isActive: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('itemDefinitionRow', () => {
  it('un producto lleva precio, mínimo legible y referencia del código', () => {
    expect(itemDefinitionRow(BASE)).toEqual({
      id: 'i1',
      reference: 12,
      code: 'INV-0012',
      name: 'Cera en pasta',
      category: 'Ceras',
      unit: 'unidad',
      price: '$14.00',
      minStock: '2.5',
      isActive: true,
    });
  });

  it('un insumo no muestra precio', () => {
    expect(itemDefinitionRow({ ...BASE, kind: 'SUPPLY', price: '0.00' }).price).toBeNull();
  });

  it('sin categoría ni mínimo, quedan vacíos', () => {
    const row = itemDefinitionRow({ ...BASE, category: null, minStock: '0.000', isActive: false });
    expect(row.category).toBeNull();
    expect(row.minStock).toBeNull();
    expect(row.isActive).toBe(false);
  });
});
