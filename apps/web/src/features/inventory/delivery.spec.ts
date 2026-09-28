import {
  createInventoryDeliverySchema,
  type InventoryEmployeeOption,
  type InventoryItem,
} from '@elite/shared';

import {
  ONE_UNIT_MILLI,
  deliveryDraft,
  deliveryMovementOf,
  deliverySummary,
  employeesMatching,
  groupItems,
  initialsOf,
  isShort,
  itemChips,
  leftAfter,
  stepLine,
  typeLine,
} from './delivery';

const EMPLOYEE = '5f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const SODA = '0b8a4a8e-4d2e-4f55-9d57-4a1d2b1c9e01';
const RAG = '1c9b5b9f-5e3f-4a66-8e68-5b2e3c2d0f12';

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: SODA,
    code: 'INV-0001',
    barcode: null,
    name: 'Coca cola',
    kind: 'PRODUCT',
    category: { id: 'c-drinks', name: 'Bebidas' },
    unit: 'unidad',
    price: '1.25',
    taxRate: '0.1300',
    averageCost: '0.70',
    stockOnHand: '3.000',
    minStock: '5.000',
    isLowStock: true,
    isActive: true,
    createdAt: '2026-09-26T15:00:00.000Z',
    updatedAt: '2026-09-26T15:00:00.000Z',
    ...overrides,
  };
}

const soda = item();
const water = item({ id: 'w', name: 'Agua', price: '0.75' });
const snack = item({ id: 's', name: 'Churritos', category: { id: 'c-snacks', name: 'Snacks' } });
const loose = item({ id: 'l', name: 'Ambientador', category: null });
const rag = item({
  id: RAG,
  name: 'Franela',
  kind: 'SUPPLY',
  price: '0.00',
  category: { id: 'c-clean', name: 'Limpieza' },
});

describe('qué deja la entrega en el kardex (091 RN-1)', () => {
  it('un producto es consumo y un insumo es despacho', () => {
    expect(deliveryMovementOf('PRODUCT')).toBe('CONSUMPTION');
    expect(deliveryMovementOf('SUPPLY')).toBe('DISPATCH');
  });

  it('el resumen separa consumo, con su valor, de despacho', () => {
    const lines = [
      { itemId: SODA, quantity: '2' },
      { itemId: RAG, quantity: '1' },
      { itemId: 'w', quantity: '0' },
    ];
    const byId = new Map([soda, rag, water].map((candidate) => [candidate.id, candidate]));

    expect(deliverySummary(lines, (id) => byId.get(id))).toEqual({
      consumption: { count: 1, cents: 250 },
      dispatch: { count: 1 },
    });
  });
});

describe('el − N + de cada fila', () => {
  it('sube desde cero, suma, resta y en cero la línea se va', () => {
    const one = stepLine([], SODA, ONE_UNIT_MILLI);
    expect(one).toEqual([{ itemId: SODA, quantity: '1' }]);

    const two = stepLine(one, SODA, ONE_UNIT_MILLI);
    expect(two).toEqual([{ itemId: SODA, quantity: '2' }]);

    expect(stepLine(stepLine(two, SODA, -ONE_UNIT_MILLI), SODA, -ONE_UNIT_MILLI)).toEqual([]);
  });

  it('lo escrito a mano se guarda tal cual, aunque se esté escribiendo', () => {
    expect(typeLine([{ itemId: RAG, quantity: '1' }], RAG, '0.')).toEqual([
      { itemId: RAG, quantity: '0.' },
    ]);
  });

  it('avisa cuando no alcanza y cuánto queda', () => {
    expect(isShort(soda, { itemId: SODA, quantity: '4' })).toBe(true);
    expect(isShort(soda, { itemId: SODA, quantity: '3' })).toBe(false);
    expect(leftAfter(soda, { itemId: SODA, quantity: '1.5' })).toBe(1500);
  });
});

describe('lo que va al API', () => {
  it('solo las líneas con cantidad, la nota si hay, y pasa el schema', () => {
    const draft = deliveryDraft(EMPLOYEE, '  ', [
      { itemId: SODA, quantity: '2' },
      { itemId: RAG, quantity: '' },
    ]);

    expect(draft).toEqual({ employeeId: EMPLOYEE, lines: [{ itemId: SODA, quantity: '2.000' }] });
    expect(createInventoryDeliverySchema.safeParse(draft).success).toBe(true);
  });

  it('el schema no deja repetir artículo (091 RN-3)', () => {
    const repeated = {
      employeeId: EMPLOYEE,
      lines: [
        { itemId: SODA, quantity: '1' },
        { itemId: SODA, quantity: '2' },
      ],
    };

    expect(createInventoryDeliverySchema.safeParse(repeated).success).toBe(false);
  });
});

describe('a quién (091)', () => {
  const people: InventoryEmployeeOption[] = [
    { id: 'e1', fullName: 'Luis Martínez' },
    { id: 'e2', fullName: 'José Ramírez' },
  ];

  it('busca sin tildes ni mayúsculas', () => {
    expect(employeesMatching(people, 'jose').map((person) => person.id)).toEqual(['e2']);
    expect(employeesMatching(people, 'MARTI').map((person) => person.id)).toEqual(['e1']);
    expect(employeesMatching(people, '  ')).toHaveLength(2);
  });

  it('las iniciales son de las dos primeras palabras', () => {
    expect(initialsOf('Luis Martínez')).toBe('LM');
    expect(initialsOf('ana')).toBe('A');
  });
});

describe('chips de categoría (085 sobre productos e insumos)', () => {
  it('productos antes que insumos, alfabético y «Sin categoría» al final', () => {
    const groups = groupItems([rag, loose, snack, soda, water]);

    expect(groups.map((group) => `${group.kind}:${group.name}`)).toEqual([
      'PRODUCT:Bebidas',
      'PRODUCT:Snacks',
      'PRODUCT:Sin categoría',
      'SUPPLY:Limpieza',
    ]);
    expect(groups[0]?.items.map((candidate) => candidate.name)).toEqual(['Agua', 'Coca cola']);
  });

  it('el chip cuenta sus artículos y lo que llevás de ellos', () => {
    const chips = itemChips([soda, water, rag], [{ itemId: SODA, quantity: '2' }]);

    expect(chips[0]).toMatchObject({ name: 'Bebidas', total: 2, picked: 2000 });
    expect(chips[1]).toMatchObject({ name: 'Limpieza', total: 1, picked: 0 });
  });
});
