import type { ServiceDetail } from '@elite/shared';

import {
  groupByCategory,
  repriceForBodyType,
  selectedLines,
  toggleService,
} from './service-groups';

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

const wash = service();
const wax = service({ id: 'srv-2', code: 'SRV-0002', name: 'Lavado + pasteado' });
const polish = service({
  id: 'srv-3',
  code: 'SRV-0101',
  name: 'Pulido',
  category: rims,
  defaultPrice: '15.00',
});
const catalog = [polish, wash, wax];

describe('agrupado del catálogo por rubro (039)', () => {
  it('ordena los rubros por sortOrder y no aplana el catálogo', () => {
    const groups = groupByCategory(catalog);

    expect(groups.map((group) => group.name)).toEqual(['Lavado premium', 'Pulido de silvines']);
    expect(groups[0].services.map((item) => item.id)).toEqual(['srv-1', 'srv-2']);
  });

  it('un rubro sin servicios activos no se pinta', () => {
    const groups = groupByCategory([
      wash,
      service({ id: 'srv-4', category: rims, isActive: false }),
    ]);

    expect(groups.map((group) => group.id)).toEqual(['cat-1']);
  });
});

describe('varios servicios por rubro (111)', () => {
  const none = { selected: [], prices: {} };

  it('elegir de otro rubro no suelta el primero', () => {
    expect(toggleService({ selected: ['srv-1'], prices: {} }, polish).selected).toEqual([
      'srv-1',
      'srv-3',
    ]);
  });

  it('elegir otro del mismo rubro se suma al anterior y conserva su precio', () => {
    const next = toggleService({ selected: ['srv-1'], prices: { 'srv-1': '6.00' } }, wax);

    expect(next.selected).toEqual(['srv-1', 'srv-2']);
    expect(next.prices).toEqual({ 'srv-1': '6.00' });
  });

  it('tocar el ya elegido lo suelta: el mismo servicio dos veces no existe', () => {
    const once = toggleService(none, wash);

    expect(toggleService(once, wash).selected).toEqual([]);
  });

  it('dos del mismo rubro son dos líneas', () => {
    const lines = selectedLines(catalog, { selected: ['srv-2', 'srv-1'], prices: {} }, 'b1');

    expect(lines.map((line) => line.id)).toEqual(['srv-1', 'srv-2']);
  });
});

describe('la selección y sus líneas (050)', () => {
  const selection = { selected: ['srv-3', 'srv-1'], prices: { 'srv-1': '6.00' } };

  it('arma las líneas en el orden de los rubros, no en el que se tocaron', () => {
    const lines = selectedLines(catalog, selection, 'b1');

    expect(lines.map((line) => line.id)).toEqual(['srv-1', 'srv-3']);
    expect(lines.map((line) => line.categoryName)).toEqual([
      'Lavado premium',
      'Pulido de silvines',
    ]);
  });

  it('cobra el catálogo salvo la línea descontada, que conserva su tope', () => {
    const lines = selectedLines(catalog, selection, 'b1');

    expect(lines.map((line) => line.price)).toEqual(['6.00', '15.00']);
    expect(lines.map((line) => line.catalog)).toEqual(['8.00', '15.00']);
  });

  it('usa el precio del tipo de carro cuando la matriz lo tiene', () => {
    const withMatrix = [{ ...wash, prices: [{ bodyTypeId: 'b2', price: '10.00' }] }];
    const lines = selectedLines(withMatrix, { selected: ['srv-1'], prices: {} }, 'b2');

    expect(lines[0].catalog).toBe('10.00');
  });

  it('soltar un servicio se lleva su descuento; el otro lo conserva', () => {
    const next = toggleService(selection, wash);

    expect(next.selected).toEqual(['srv-3']);
    expect(next.prices).toEqual({});
  });

  it('cambiar el tipo de carro recorta el descuento al nuevo tope', () => {
    const cheaper = [{ ...wash, prices: [{ bodyTypeId: 'b2', price: '4.00' }] }, polish];
    const next = repriceForBodyType(
      { selected: ['srv-1'], prices: { 'srv-1': '6.00' } },
      cheaper,
      'b1',
      'b2',
    );

    expect(next.prices['srv-1']).toBe('4.00');
  });

  it('cambiar el tipo de carro mueve al catálogo nuevo la línea que no se tocó', () => {
    const pricier = [{ ...wash, prices: [{ bodyTypeId: 'b2', price: '10.00' }] }, polish];
    const next = repriceForBodyType(
      { selected: ['srv-1'], prices: { 'srv-1': '8.00' } },
      pricier,
      'b1',
      'b2',
    );

    expect(next.prices['srv-1']).toBe('10.00');
  });

  it('cambiar el tipo de carro conserva el recargo si sigue arriba del catálogo nuevo (087)', () => {
    const pricier = [{ ...wash, prices: [{ bodyTypeId: 'b2', price: '10.00' }] }, polish];
    const next = repriceForBodyType(
      { selected: ['srv-1'], prices: { 'srv-1': '12.00' } },
      pricier,
      'b1',
      'b2',
    );

    expect(next.prices['srv-1']).toBe('12.00');
  });
});
