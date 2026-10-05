import {
  comboPriceViews,
  comboStatusParam,
  componentsLabel,
  outOfStockLabel,
  rangeLabel,
  shortDate,
  weekdaysLabel,
  whenLabel,
} from './combo-format';

const TODAY = '2026-10-05';
const SEDAN = { id: 'bt-sedan', name: 'Sedán' };
const SUV = { id: 'bt-suv', name: 'Camioneta' };

describe('la vigencia de un combo (104)', () => {
  it('los días, cortos', () => {
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('');
    expect(weekdaysLabel([5, 1, 2, 3, 4])).toBe('Lun a vie');
    expect(weekdaysLabel([0, 6])).toBe('Fines de semana');
    expect(weekdaysLabel([3])).toBe('Mié');
    expect(weekdaysLabel([5, 1, 3])).toBe('Lun, mié y vie');
    expect(weekdaysLabel([0, 1])).toBe('Lun y dom');
  });

  it('las fechas sin año si son de este año', () => {
    expect(shortDate('2026-10-05', TODAY)).toBe('5 oct');
    expect(shortDate('2027-01-31', TODAY)).toBe('31 ene 2027');
  });

  it('el rango, o «Desde» sin fin, y los días al lado', () => {
    expect(rangeLabel({ validFrom: '2026-10-01', validTo: '2026-12-31' }, TODAY)).toBe(
      '1 oct – 31 dic',
    );
    expect(rangeLabel({ validFrom: '2026-10-01', validTo: null }, TODAY)).toBe('Desde 1 oct');
    expect(whenLabel({ validFrom: '2026-10-01', validTo: null, weekdays: [0, 6] }, TODAY)).toBe(
      'Desde 1 oct · Fines de semana',
    );
    expect(
      whenLabel({ validFrom: '2026-10-01', validTo: null, weekdays: [0, 1, 2, 3, 4, 5, 6] }, TODAY),
    ).toBe('Desde 1 oct');
  });

  it('«Todos» no filtra por estado', () => {
    expect(comboStatusParam('all')).toBeUndefined();
    expect(comboStatusParam('PAUSED')).toBe('PAUSED');
  });
});

describe('lo que trae y lo que cuesta un combo (104)', () => {
  it('los componentes en una línea, el producto con su ×N', () => {
    expect(
      componentsLabel([
        { name: 'Lavado completo', quantity: 1 },
        { name: 'Cera', quantity: 2 },
      ]),
    ).toBe('Lavado completo · Cera ×2');
  });

  it('el chip del primer producto que falta', () => {
    expect(outOfStockLabel(['Cera en pasta', 'Aromatizante'])).toBe('Sin cera en pasta');
    expect(outOfStockLabel([])).toBeNull();
  });

  it('un solo precio si todos los tipos dan igual', () => {
    expect(
      comboPriceViews(
        [
          { bodyTypeId: SEDAN.id, listPrice: '16.00', price: '12.00' },
          { bodyTypeId: SUV.id, listPrice: '16.00', price: '12.00' },
        ],
        [SEDAN, SUV],
      ),
    ).toEqual([{ bodyTypeName: null, price: '$12.00', saving: '−$4.00' }]);
  });

  it('si no, uno por tipo en el orden del catálogo', () => {
    expect(
      comboPriceViews(
        [
          { bodyTypeId: SUV.id, listPrice: '20.00', price: '15.00' },
          { bodyTypeId: SEDAN.id, listPrice: '16.00', price: '16.00' },
        ],
        [SEDAN, SUV],
      ),
    ).toEqual([
      { bodyTypeName: 'Sedán', price: '$16.00', saving: null },
      { bodyTypeName: 'Camioneta', price: '$15.00', saving: '−$5.00' },
    ]);
    expect(comboPriceViews([], [SEDAN])).toEqual([]);
  });
});
