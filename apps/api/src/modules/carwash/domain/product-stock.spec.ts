import { productReturnsOnVoid, productStockChanges } from './product-stock';

describe('productStockChanges (065 RN-4)', () => {
  it('una linea nueva se vende entera', () => {
    expect(productStockChanges([], [{ inventoryItemId: 'wax', quantity: 2000 }])).toEqual([
      { inventoryItemId: 'wax', type: 'SALE', quantity: -2000 },
    ]);
  });

  it('mas cantidad vende la diferencia; menos la devuelve', () => {
    const before = [
      { inventoryItemId: 'wax', quantity: 2000 },
      { inventoryItemId: 'scent', quantity: 3000 },
    ];
    const after = [
      { inventoryItemId: 'wax', quantity: 2500 },
      { inventoryItemId: 'scent', quantity: 1000 },
    ];

    expect(productStockChanges(before, after)).toEqual([
      { inventoryItemId: 'scent', type: 'SALE_RETURN', quantity: 2000 },
      { inventoryItemId: 'wax', type: 'SALE', quantity: -500 },
    ]);
  });

  it('quitar la linea devuelve todo', () => {
    expect(productStockChanges([{ inventoryItemId: 'wax', quantity: 2000 }], [])).toEqual([
      { inventoryItemId: 'wax', type: 'SALE_RETURN', quantity: 2000 },
    ]);
  });

  it('la misma cantidad no mueve nada', () => {
    const lines = [{ inventoryItemId: 'wax', quantity: 2000 }];

    expect(productStockChanges(lines, lines)).toEqual([]);
  });

  it('sale ordenado por articulo, para bloquear las filas siempre en el mismo orden', () => {
    const changes = productStockChanges(
      [],
      [
        { inventoryItemId: 'c', quantity: 1000 },
        { inventoryItemId: 'a', quantity: 1000 },
        { inventoryItemId: 'b', quantity: 1000 },
      ],
    );

    expect(changes.map((change) => change.inventoryItemId)).toEqual(['a', 'b', 'c']);
  });

  it('si llegara el mismo articulo dos veces, cuenta la suma', () => {
    expect(
      productStockChanges(
        [{ inventoryItemId: 'wax', quantity: 1000 }],
        [
          { inventoryItemId: 'wax', quantity: 1000 },
          { inventoryItemId: 'wax', quantity: 500 },
        ],
      ),
    ).toEqual([{ inventoryItemId: 'wax', type: 'SALE', quantity: -500 }]);
  });
});

describe('productReturnsOnVoid (065 RN-5)', () => {
  it('devuelve cada producto del lavado', () => {
    expect(
      productReturnsOnVoid([
        { inventoryItemId: 'wax', quantity: 2000 },
        { inventoryItemId: 'scent', quantity: 500 },
      ]),
    ).toEqual([
      { inventoryItemId: 'scent', type: 'SALE_RETURN', quantity: 500 },
      { inventoryItemId: 'wax', type: 'SALE_RETURN', quantity: 2000 },
    ]);
  });

  it('un lavado sin productos no mueve nada', () => {
    expect(productReturnsOnVoid([])).toEqual([]);
  });
});
