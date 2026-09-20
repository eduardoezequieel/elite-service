import { API_ERROR_CODES } from '@elite/shared';
import type { ServiceDetail } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { buildTicketItems, type RequestedItem } from './build-ticket-items';

const premium = { id: 'cat-1', name: 'Lavado premium', sortOrder: 1, isActive: true };
const rims = { id: 'cat-2', name: 'Pulido de silvines', sortOrder: 4, isActive: true };

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
});
