import {
  catalogPriceFor,
  discountOf,
  rejectPrice,
  repriceForBodyType,
  totalOf,
  type PriceableService,
} from './pricing';

const SEDAN = 'body-sedan';
const SUV = 'body-suv';
const PICKUP = 'body-pickup';

/** SRV-0001 del seed: 8.00 base, 10.00 camioneta y pick up. */
const lavado: PriceableService = {
  id: 'srv-1',
  code: 'SRV-0001',
  name: 'Lavado + aspirado',
  isActive: true,
  defaultPrice: 800,
  prices: [
    { bodyTypeId: SEDAN, price: 800 },
    { bodyTypeId: SUV, price: 1000 },
    { bodyTypeId: PICKUP, price: 1000 },
  ],
};

/** Un aromatizante: mismo precio para cualquier carro, sin matriz (RN-3). */
const aromatizante: PriceableService = {
  id: 'srv-2',
  code: 'SRV-0009',
  name: 'Aromatizante',
  isActive: true,
  defaultPrice: 200,
  prices: [],
};

describe('catalogPriceFor (RN-2)', () => {
  it('usa la fila de la matriz cuando existe para ese tipo', () => {
    expect(catalogPriceFor(lavado, SUV)).toBe(1000);
    expect(catalogPriceFor(lavado, SEDAN)).toBe(800);
  });

  it('usa el precio base cuando el servicio no tiene matriz (RN-3)', () => {
    expect(catalogPriceFor(aromatizante, SUV)).toBe(200);
    expect(catalogPriceFor(aromatizante, PICKUP)).toBe(200);
  });

  /**
   * La distincion que da sentido a RN-2: que falte la celda no quiere decir
   * que el servicio sea gratis para ese carro, quiere decir que se usa el base.
   */
  it('una celda que falta significa "usar el base", no cero', () => {
    const soloSedan: PriceableService = { ...lavado, prices: [{ bodyTypeId: SEDAN, price: 800 }] };

    expect(catalogPriceFor(soloSedan, SUV)).toBe(800);
    expect(catalogPriceFor(soloSedan, SUV)).not.toBe(0);
  });
});

describe('rejectPrice (RN-5)', () => {
  it('deja bajar el precio', () => {
    expect(rejectPrice(800, 1000)).toBeNull();
  });

  it('deja dejarlo igual al catalogo', () => {
    expect(rejectPrice(1000, 1000)).toBeNull();
  });

  it('deja llegar a cero: la cortesia se anula despues, no se prohibe aca', () => {
    expect(rejectPrice(0, 1000)).toBeNull();
  });

  it('no deja subirlo por encima del catalogo', () => {
    expect(rejectPrice(1200, 1000)).toBe('ABOVE_CATALOG');
  });

  it('no deja un precio negativo', () => {
    expect(rejectPrice(-1, 1000)).toBe('NEGATIVE');
  });
});

describe('totalOf y discountOf (RN-6)', () => {
  it('suma lo que se cobra, no lo que decia el catalogo', () => {
    const items = [
      { catalogPrice: 1000, unitPrice: 800 },
      { catalogPrice: 400, unitPrice: 400 },
    ];

    expect(totalOf(items)).toBe(1200);
    expect(discountOf(items)).toBe(200);
  });

  it('un ticket sin lineas vale cero', () => {
    expect(totalOf([])).toBe(0);
    expect(discountOf([])).toBe(0);
  });
});

describe('repriceForBodyType (RN-4)', () => {
  it('mueve las lineas que estaban al precio de catalogo', () => {
    const items = [{ catalogPrice: 800, unitPrice: 800, service: lavado }];

    expect(repriceForBodyType(items, SUV)).toEqual([{ catalogPrice: 1000, unitPrice: 1000 }]);
  });

  /**
   * El descuento lo puso una persona mirando el carro. Cambiar el tipo de
   * carroceria no puede deshacer esa decision.
   */
  it('respeta el descuento ya aplicado y solo mueve el techo', () => {
    const items = [{ catalogPrice: 800, unitPrice: 600, service: lavado }];

    expect(repriceForBodyType(items, SUV)).toEqual([{ catalogPrice: 1000, unitPrice: 600 }]);
  });

  it('si el techo nuevo queda por debajo del descuento, gana el techo (RN-5)', () => {
    const items = [{ catalogPrice: 1000, unitPrice: 900, service: lavado }];

    expect(repriceForBodyType(items, SEDAN)).toEqual([{ catalogPrice: 800, unitPrice: 800 }]);
  });

  it('deja intacta una linea cuyo servicio ya no existe: manda el snapshot', () => {
    const items = [{ catalogPrice: 1500, unitPrice: 1200, service: null }];

    expect(repriceForBodyType(items, SUV)).toEqual([{ catalogPrice: 1500, unitPrice: 1200 }]);
  });
});
