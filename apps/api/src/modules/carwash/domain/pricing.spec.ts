import {
  catalogPriceFor,
  discountOf,
  isPriceOpen,
  lineTotal,
  needsPriceAuthorization,
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

describe('isPriceOpen / needsPriceAuthorization (060 RN-1)', () => {
  const atCatalog = { catalogPrice: 1400, unitPrice: 1400 };
  const discounted = { catalogPrice: 1400, unitPrice: 1000 };

  it('el precio está abierto mientras el lavado está abierto o lavándose', () => {
    expect(isPriceOpen('OPEN')).toBe(true);
    expect(isPriceOpen('WASHING')).toBe(true);
    expect(isPriceOpen('READY')).toBe(false);
    expect(isPriceOpen('PAID')).toBe(false);
  });

  it('recepción rebaja sin firma mientras el lavado está abierto', () => {
    expect(needsPriceAuthorization('OPEN', [discounted])).toBe(false);
    expect(needsPriceAuthorization('WASHING', [discounted])).toBe(false);
  });

  it('desde listo, una línea rebajada por alta o edición pide autorización', () => {
    expect(needsPriceAuthorization('READY', [atCatalog, discounted])).toBe(true);
  });

  it('desde listo, guardar todo al precio de catálogo no pide nada', () => {
    expect(needsPriceAuthorization('READY', [atCatalog, atCatalog])).toBe(false);
  });
});

describe('lineTotal y totalOf con cantidades (065 RN-6)', () => {
  it('una linea sin cantidad es una unidad', () => {
    expect(lineTotal(800)).toBe(800);
    expect(totalOf([{ catalogPrice: 800, unitPrice: 800 }])).toBe(800);
  });

  it('multiplica precio por cantidad en milesimas', () => {
    expect(lineTotal(300, 2000)).toBe(600);
    expect(lineTotal(1999, 3000)).toBe(5997);
  });

  it('redondea al centavo con mitad hacia arriba', () => {
    // 0.5 × $2.25 = $1.125 → $1.13
    expect(lineTotal(225, 500)).toBe(113);
    // 0.333 × $1.00 = $0.333 → $0.33
    expect(lineTotal(100, 333)).toBe(33);
    // 1.5 × $0.01 = $0.015 → $0.02
    expect(lineTotal(1, 1500)).toBe(2);
  });

  it('no pierde centavos con numeros grandes', () => {
    // $9,999,999.99 × 99,999.999: el producto intermedio no cabe en un double.
    expect(lineTotal(999_999_999, 99_999_999)).toBe(99_999_998_900_000);
  });

  it('el total del ticket suma cada linea ya redondeada', () => {
    expect(
      totalOf([
        { catalogPrice: 1000, unitPrice: 1000 },
        { catalogPrice: 300, unitPrice: 300, quantity: 2000 },
        { catalogPrice: 225, unitPrice: 225, quantity: 500 },
      ]),
    ).toBe(1000 + 600 + 113);
  });

  it('el descuento tambien se mide por la cantidad', () => {
    expect(discountOf([{ catalogPrice: 300, unitPrice: 250, quantity: 2000 }])).toBe(100);
  });
});
