import { API_ERROR_CODES } from '@elite/shared';
import type { ServiceDetail } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import {
  buildProductItems,
  buildTicketItems,
  buildTicketLines,
  productIdsOf,
  type RequestedItem,
} from './build-ticket-items';
import type { InventoryProductRecord } from './ports/inventory-catalog';

const premium = {
  id: 'cat-1',
  name: 'Lavado premium',
  sortOrder: 1,
  isActive: true,
  isExtra: false,
};
const rims = {
  id: 'cat-2',
  name: 'Pulido de silvines',
  sortOrder: 4,
  isActive: true,
  isExtra: true,
};

function service(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return {
    id: 'srv-1',
    code: 'SRV-0001',
    name: 'Lavado + aspirado',
    category: premium,
    defaultPrice: '8.00',
    taxRate: '0.1300',
    isActive: true,
    prices: [],
    ...overrides,
  };
}

const catalog: ServiceDetail[] = [
  service(),
  service({ id: 'srv-2', code: 'SRV-0002', name: 'Lavado + pasteado', defaultPrice: '10.00' }),
  service({
    id: 'srv-3',
    code: 'SRV-0101',
    name: 'Pulido de silvines',
    category: rims,
    defaultPrice: '15.00',
  }),
];

/** `buildTicketItems` es sincrono; `captureApiError` espera una promesa. */
function failureOf(requested: RequestedItem[]) {
  return captureApiError((async () => buildTicketItems(requested, catalog, 'b1'))());
}

describe('buildTicketItems: un servicio por rubro (039)', () => {
  it('suma dos servicios de categorias distintas', () => {
    const items = buildTicketItems([{ serviceId: 'srv-1' }, { serviceId: 'srv-3' }], catalog, 'b1');

    expect(items.map((item) => item.serviceId)).toEqual(['srv-1', 'srv-3']);
    expect(items.map((item) => item.catalogPrice)).toEqual([800, 1500]);
    expect(items.map((item) => item.sortOrder)).toEqual([0, 1]);
  });

  it('rechaza dos servicios de la misma categoria', async () => {
    const failure = await failureOf([{ serviceId: 'srv-1' }, { serviceId: 'srv-2' }]);

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.DUPLICATE_SERVICE_CATEGORY);
    expect(failure.body.details).toEqual({
      categoryId: 'cat-1',
      serviceIds: ['srv-1', 'srv-2'],
    });
  });

  it('el descuento sigue siendo por linea', () => {
    const items = buildTicketItems(
      [{ serviceId: 'srv-1', unitPrice: '6.00' }, { serviceId: 'srv-3' }],
      catalog,
      'b1',
    );

    expect(items.map((item) => item.unitPrice)).toEqual([600, 1500]);
  });

  it('un servicio se puede cobrar por encima del catalogo (087)', () => {
    const [line] = buildTicketItems([{ serviceId: 'srv-1', unitPrice: '12.00' }], catalog, 'b1');

    expect(line?.catalogPrice).toBe(800);
    expect(line?.unitPrice).toBe(1200);
  });

  it('un servicio sigue sin poder ser negativo', async () => {
    const failure = await failureOf([{ serviceId: 'srv-1', unitPrice: '-1.00' }]);

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });
});

const products: InventoryProductRecord[] = [
  {
    id: 'wax',
    code: 'INV-0001',
    name: 'Cera en pasta',
    kind: 'PRODUCT',
    isActive: true,
    price: 300,
    taxRate: '0.1300',
  },
  {
    id: 'rag',
    code: 'INV-0002',
    name: 'Franela',
    kind: 'SUPPLY',
    isActive: true,
    price: 0,
    taxRate: '0.1300',
  },
];

describe('buildProductItems (065 RN-6, RN-7, RN-9)', () => {
  it('copia codigo, nombre, precio del articulo, IVA y cantidad', () => {
    const [line] = buildProductItems([{ inventoryItemId: 'wax', quantity: '2.500' }], products);

    expect(line).toEqual({
      kind: 'PRODUCT',
      serviceId: null,
      inventoryItemId: 'wax',
      serviceCode: 'INV-0001',
      serviceName: 'Cera en pasta',
      catalogPrice: 300,
      unitPrice: 300,
      quantity: 2500,
      taxRate: '0.1300',
      sortOrder: 0,
      comboId: null,
      comboName: null,
    });
  });

  it('acepta un precio rebajado y rechaza uno por encima del articulo', async () => {
    const [line] = buildProductItems(
      [{ inventoryItemId: 'wax', quantity: '1.000', unitPrice: '2.00' }],
      products,
    );

    expect(line?.unitPrice).toBe(200);

    const failure = await captureApiError(
      (async () =>
        buildProductItems(
          [{ inventoryItemId: 'wax', quantity: '1.000', unitPrice: '3.01' }],
          products,
        ))(),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.PRICE_ABOVE_CATALOG);
  });

  it('un insumo no se vende', async () => {
    const failure = await captureApiError(
      (async () => buildProductItems([{ inventoryItemId: 'rag', quantity: '1.000' }], products))(),
    );

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.ITEM_NOT_SELLABLE);
  });

  it('cada producto una vez por lavado', async () => {
    const failure = await captureApiError(
      (async () =>
        buildProductItems(
          [
            { inventoryItemId: 'wax', quantity: '1.000' },
            { inventoryItemId: 'wax', quantity: '2.000' },
          ],
          products,
        ))(),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });
});

describe('buildTicketLines (065)', () => {
  it('mezcla servicios y productos en el orden pedido; la 039 no mira productos', () => {
    const lines = buildTicketLines(
      [
        { inventoryItemId: 'wax', quantity: '1.000' },
        { serviceId: 'srv-1' },
        { serviceId: 'srv-3' },
      ],
      catalog,
      products,
      'b1',
    );

    expect(lines.map((line) => [line.kind, line.sortOrder])).toEqual([
      ['PRODUCT', 0],
      ['SERVICE', 1],
      ['SERVICE', 2],
    ]);
    expect(lines[1]?.quantity).toBe(1000);
  });

  it('productIdsOf no repite ids', () => {
    expect(
      productIdsOf([
        { serviceId: 'srv-1' },
        { inventoryItemId: 'wax', quantity: '1.000' },
        { inventoryItemId: 'wax', quantity: '2.000' },
      ]),
    ).toEqual(['wax']);
  });
});
