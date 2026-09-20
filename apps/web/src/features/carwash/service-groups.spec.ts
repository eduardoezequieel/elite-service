import type { ServiceDetail } from '@elite/shared';

import { groupByCategory, toggleInCategory } from './service-groups';

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

const wash = service();
const wax = service({ id: 'srv-2', code: 'SRV-0002', name: 'Lavado + pasteado' });
const polish = service({ id: 'srv-3', code: 'SRV-0101', name: 'Pulido', category: rims });
const catalog = [polish, wash, wax];

describe('agrupado del catálogo por rubro (039)', () => {
  it('ordena los rubros por sortOrder y no aplana el catálogo', () => {
    const groups = groupByCategory(catalog);

    expect(groups.map((group) => group.name)).toEqual(['Lavado premium', 'Pulido de silvines']);
    expect(groups[0].services.map((item) => item.id)).toEqual(['srv-1', 'srv-2']);
  });

  it('un rubro sin servicios activos no se pinta', () => {
    const groups = groupByCategory([wash, service({ id: 'srv-4', category: rims, isActive: false })]);

    expect(groups.map((group) => group.id)).toEqual(['cat-1']);
  });
});

describe('un servicio por rubro, los rubros se suman (039)', () => {
  it('elegir de otro rubro no suelta el primero', () => {
    expect(toggleInCategory(['srv-1'], polish, catalog)).toEqual(['srv-1', 'srv-3']);
  });

  it('elegir otro del mismo rubro reemplaza al anterior', () => {
    expect(toggleInCategory(['srv-1', 'srv-3'], wax, catalog)).toEqual(['srv-3', 'srv-2']);
  });

  it('tocar el ya elegido lo suelta', () => {
    expect(toggleInCategory(['srv-1', 'srv-3'], wash, catalog)).toEqual(['srv-3']);
  });
});
