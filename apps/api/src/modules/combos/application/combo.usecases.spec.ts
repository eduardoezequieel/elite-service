import { API_ERROR_CODES, createComboSchema, updateComboSchema } from '@elite/shared';
import type { CreateComboInput } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { ComboUseCases } from './combo.usecases';
import { InMemoryComboRepository } from './testing/in-memory-combo.repository';

/** Lunes 5 de octubre de 2026. */
const TODAY = '2026-10-05';
const SEDAN = '00000000-0000-4000-8000-0000000000a1';
const SUV = '00000000-0000-4000-8000-0000000000a2';
const WASH = '00000000-0000-4000-8000-0000000000b1';
const WAX_SERVICE = '00000000-0000-4000-8000-0000000000b2';
const OLD_SERVICE = '00000000-0000-4000-8000-0000000000b3';
const SCENT = '00000000-0000-4000-8000-0000000000c1';
const RAG = '00000000-0000-4000-8000-0000000000c2';

function build(today = TODAY) {
  const repo = new InMemoryComboRepository();

  repo.bodyTypeIds = [SEDAN, SUV];
  // Lavado: $10 sedán, $14 camioneta. Encerado: $5 en cualquiera.
  repo.addService({ id: WASH, defaultPrice: 1000, prices: [{ bodyTypeId: SUV, price: 1400 }] });
  repo.addService({ id: WAX_SERVICE, defaultPrice: 500 });
  repo.addService({ id: OLD_SERVICE, isActive: false });
  repo.addProduct({ id: SCENT, name: 'Aromatizante', defaultPrice: 150, stockOnHand: 2000 });
  repo.addProduct({ id: RAG, sellable: false });

  return { repo, usecases: new ComboUseCases(repo, () => today) };
}

function fixedInput(overrides: Record<string, unknown> = {}): CreateComboInput {
  return createComboSchema.parse({
    name: 'Combo verano',
    items: [{ serviceId: WASH }, { inventoryItemId: SCENT, quantity: 2 }],
    pricingMode: 'FIXED',
    prices: [
      { bodyTypeId: SEDAN, price: '12.00' },
      { bodyTypeId: SUV, price: '15.00' },
    ],
    validFrom: '2026-10-01',
    weekdays: [1, 2, 3, 4, 5],
    ...overrides,
  });
}

describe('ComboUseCases.create (104)', () => {
  it('guarda un combo fijo con código correlativo y precio por tipo (criterio 1)', async () => {
    const { usecases } = build();

    const first = await usecases.create(fixedInput());
    const second = await usecases.create(fixedInput({ name: 'Otro combo' }));

    expect(first.code).toBe('CMB-0001');
    expect(second.code).toBe('CMB-0002');
    expect(first).toMatchObject({
      status: 'LIVE',
      weekdays: [1, 2, 3, 4, 5],
      discountPercent: null,
      outOfStock: [],
      prices: [
        { bodyTypeId: SEDAN, listPrice: '13.00', price: '12.00' },
        { bodyTypeId: SUV, listPrice: '17.00', price: '15.00' },
      ],
    });
    expect(first.items).toEqual([
      {
        kind: 'SERVICE',
        serviceId: WASH,
        inventoryItemId: null,
        code: `SRV-${WASH}`,
        name: `Servicio ${WASH}`,
        quantity: 1,
        stockOnHand: null,
      },
      {
        kind: 'PRODUCT',
        serviceId: null,
        inventoryItemId: SCENT,
        code: `INV-${SCENT}`,
        name: 'Aromatizante',
        quantity: 2,
        stockOnHand: '2.000',
      },
    ]);
  });

  it('PERCENT calcula el precio de cada tipo y no guarda precios (criterio 2)', async () => {
    const { usecases, repo } = build();

    const created = await usecases.create(
      fixedInput({ pricingMode: 'PERCENT', discountPercent: 15, prices: [] }),
    );

    // 13.00 × 0.85 = 11.05; 17.00 × 0.85 = 14.45
    expect(created.prices.map((row) => row.price)).toEqual(['11.05', '14.45']);
    expect(repo.rows.get(created.id)?.fixedPrices).toEqual([]);
  });

  it('PERCENT ignora los precios que vengan', async () => {
    const { usecases, repo } = build();

    const created = await usecases.create(
      fixedInput({ pricingMode: 'PERCENT', discountPercent: 10 }),
    );

    expect(repo.rows.get(created.id)?.fixedPrices).toEqual([]);
  });

  it('nombra el producto sin existencia para una unidad del combo', async () => {
    const { usecases } = build();

    const created = await usecases.create(
      fixedInput({ items: [{ serviceId: WASH }, { inventoryItemId: SCENT, quantity: 3 }] }),
    );

    expect(created.outOfStock).toEqual(['Aromatizante']);
  });

  it.each([
    [
      'servicio inactivo',
      [{ serviceId: OLD_SERVICE }, { serviceId: WASH }],
      { serviceIds: [OLD_SERVICE] },
    ],
    [
      'servicio que no existe',
      [{ serviceId: WASH }, { serviceId: '00000000-0000-4000-8000-0000000000ff' }],
      { serviceIds: ['00000000-0000-4000-8000-0000000000ff'] },
    ],
    [
      'insumo',
      [{ serviceId: WASH }, { inventoryItemId: RAG, quantity: 1 }],
      { inventoryItemIds: [RAG] },
    ],
  ])('rechaza un %s con 422 (RN-1)', async (_label, items, details) => {
    const { usecases, repo } = build();

    const failure = await captureApiError(
      usecases.create(fixedInput({ items, pricingMode: 'PERCENT', discountPercent: 10 })),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    expect(failure.body.details).toMatchObject(details);
    expect(repo.rows.size).toBe(0);
  });

  it('FIXED pide un precio para cada tipo de carro activo (RN-2)', async () => {
    const { usecases } = build();

    const failure = await captureApiError(
      usecases.create(fixedInput({ prices: [{ bodyTypeId: SEDAN, price: '12.00' }] })),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.details).toMatchObject({ field: 'prices', bodyTypeIds: [SUV] });
  });

  it('FIXED rechaza un tipo de carro que no está activo', async () => {
    const { usecases } = build();

    const failure = await captureApiError(
      usecases.create(
        fixedInput({
          prices: [
            { bodyTypeId: SEDAN, price: '12.00' },
            { bodyTypeId: SUV, price: '15.00' },
            { bodyTypeId: '00000000-0000-4000-8000-0000000000a9', price: '15.00' },
          ],
        }),
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.details).toMatchObject({ field: 'prices' });
  });

  it('FIXED tiene que quedar por debajo de la suma por separado (RN-2)', async () => {
    const { usecases } = build();

    const failure = await captureApiError(
      usecases.create(
        fixedInput({
          prices: [
            { bodyTypeId: SEDAN, price: '13.00' },
            { bodyTypeId: SUV, price: '15.00' },
          ],
        }),
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.details).toMatchObject({ field: 'prices', bodyTypeIds: [SEDAN] });
  });

  it('el nombre es único sin distinguir mayúsculas: 409 COMBO_NAME_TAKEN (RN-4)', async () => {
    const { usecases } = build();

    await usecases.create(fixedInput());

    const failure = await captureApiError(usecases.create(fixedInput({ name: 'COMBO VERANO' })));

    expect(failure.status).toBe(409);
    expect(failure.body.code).toBe(API_ERROR_CODES.COMBO_NAME_TAKEN);
  });
});

describe('ComboUseCases.update (104)', () => {
  it('pausa sin revisar precios ni componentes', async () => {
    const { usecases, repo } = build();
    const created = await usecases.create(fixedInput());

    // El servicio se desactivó después: pausar igual funciona.
    repo.addService({ id: WASH, isActive: false });

    const paused = await usecases.update(created.id, updateComboSchema.parse({ isActive: false }));

    expect(paused.status).toBe('PAUSED');
    expect(paused.code).toBe('CMB-0001');
  });

  it('los arrays reemplazan y se revalida sobre lo combinado', async () => {
    const { usecases } = build();
    const created = await usecases.create(fixedInput());

    const updated = await usecases.update(
      created.id,
      updateComboSchema.parse({
        items: [{ serviceId: WASH }, { serviceId: WAX_SERVICE }],
        prices: [
          { bodyTypeId: SEDAN, price: '14.00' },
          { bodyTypeId: SUV, price: '18.00' },
        ],
      }),
    );

    expect(updated.items.map((item) => item.serviceId)).toEqual([WASH, WAX_SERVICE]);
    expect(updated.prices).toEqual([
      { bodyTypeId: SEDAN, listPrice: '15.00', price: '14.00' },
      { bodyTypeId: SUV, listPrice: '19.00', price: '18.00' },
    ]);
  });

  it('cambiar componentes revisa los precios fijos guardados contra la suma nueva', async () => {
    const { usecases } = build();
    const created = await usecases.create(fixedInput());

    // Con un solo aromatizante la suma de sedán baja a 11.50 y el fijo de 12.00 ya no es menor.
    const failure = await captureApiError(
      usecases.update(
        created.id,
        updateComboSchema.parse({
          items: [{ serviceId: WASH }, { inventoryItemId: SCENT, quantity: 1 }],
        }),
      ),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.details).toMatchObject({ field: 'prices', bodyTypeIds: [SEDAN] });
  });

  it('pasar a PERCENT pide el descuento; pasar a FIXED, los precios', async () => {
    const { usecases } = build();
    const fixed = await usecases.create(fixedInput());
    const percent = await usecases.create(
      fixedInput({
        name: 'Con descuento',
        pricingMode: 'PERCENT',
        discountPercent: 10,
        prices: [],
      }),
    );

    const noDiscount = await captureApiError(
      usecases.update(fixed.id, { pricingMode: 'PERCENT' } as never),
    );
    const noPrices = await captureApiError(
      usecases.update(percent.id, updateComboSchema.parse({ pricingMode: 'FIXED' })),
    );
    const switched = await usecases.update(
      fixed.id,
      updateComboSchema.parse({ pricingMode: 'PERCENT', discountPercent: 20 }),
    );

    expect(noDiscount.body.details).toMatchObject({ field: 'discountPercent' });
    expect(noPrices.body.details).toMatchObject({ field: 'prices' });
    expect(switched).toMatchObject({ pricingMode: 'PERCENT', discountPercent: 20 });
    expect(switched.prices[0]).toMatchObject({ listPrice: '13.00', price: '10.40' });
  });

  it('un descuento sobre un combo fijo es 422', async () => {
    const { usecases } = build();
    const created = await usecases.create(fixedInput());

    const failure = await captureApiError(
      usecases.update(created.id, updateComboSchema.parse({ discountPercent: 10 })),
    );

    expect(failure.body.details).toMatchObject({ field: 'discountPercent' });
  });

  it('validTo antes del validFrom guardado es 422', async () => {
    const { usecases } = build();
    const created = await usecases.create(fixedInput());

    const failure = await captureApiError(
      usecases.update(created.id, updateComboSchema.parse({ validTo: '2026-09-01' })),
    );

    expect(failure.status).toBe(422);
    expect(failure.body.details).toMatchObject({ field: 'validTo' });
  });

  it('renombrar a uno que ya existe es 409; cambiar mayúsculas del propio no', async () => {
    const { usecases } = build();
    const created = await usecases.create(fixedInput());
    await usecases.create(fixedInput({ name: 'Otro' }));

    const failure = await captureApiError(
      usecases.update(created.id, updateComboSchema.parse({ name: 'otro' })),
    );
    const renamed = await usecases.update(
      created.id,
      updateComboSchema.parse({ name: 'COMBO VERANO' }),
    );

    expect(failure.body.code).toBe(API_ERROR_CODES.COMBO_NAME_TAKEN);
    expect(renamed.name).toBe('COMBO VERANO');
  });

  it('un id que no existe es 404', async () => {
    const { usecases } = build();

    const failure = await captureApiError(usecases.update('nope', {}));

    expect(failure.status).toBe(404);
  });
});

describe('ComboUseCases — estado y disponibilidad (RN-3)', () => {
  async function seeded() {
    const built = build();
    const { usecases } = built;

    const live = await usecases.create(fixedInput({ name: 'A vigente' }));
    const weekend = await usecases.create(fixedInput({ name: 'B finde', weekdays: [0, 6] }));
    const scheduled = await usecases.create(
      fixedInput({ name: 'C programado', validFrom: '2026-10-06' }),
    );
    const expired = await usecases.create(
      fixedInput({ name: 'D vencido', validFrom: '2026-09-01', validTo: '2026-10-04' }),
    );
    const paused = await usecases.create(fixedInput({ name: 'E pausado', isActive: false }));

    return { ...built, live, weekend, scheduled, expired, paused };
  }

  it('filtra la lista por estado calculado con hoy, paginada', async () => {
    const { usecases } = await seeded();
    const page = (status?: 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'PAUSED') =>
      usecases.listPage({ status, page: 1, pageSize: 25 });

    expect((await page('LIVE')).items.map((combo) => combo.name)).toEqual(['A vigente', 'B finde']);
    expect((await page('SCHEDULED')).items.map((combo) => combo.status)).toEqual(['SCHEDULED']);
    expect((await page('EXPIRED')).items.map((combo) => combo.name)).toEqual(['D vencido']);
    expect((await page('PAUSED')).items.map((combo) => combo.name)).toEqual(['E pausado']);
    expect(await page()).toMatchObject({ total: 5, page: 1, pageSize: 25 });
  });

  it('busca por nombre o código', async () => {
    const { usecases } = await seeded();

    const byName = await usecases.listPage({ search: 'finde', page: 1, pageSize: 25 });
    const byCode = await usecases.listPage({ search: 'cmb-0003', page: 1, pageSize: 25 });

    expect(byName.items.map((combo) => combo.name)).toEqual(['B finde']);
    expect(byCode.items.map((combo) => combo.name)).toEqual(['C programado']);
  });

  it('el alta del lavado solo ve los que valen hoy, con precio por tipo (criterio 3)', async () => {
    const { usecases, live } = await seeded();

    const options = await usecases.listAvailableToday();

    expect(options).toEqual([
      {
        id: live.id,
        name: 'A vigente',
        items: [
          { kind: 'SERVICE', name: `Servicio ${WASH}`, quantity: 1 },
          { kind: 'PRODUCT', name: 'Aromatizante', quantity: 2 },
        ],
        prices: [
          { bodyTypeId: SEDAN, listPrice: '13.00', price: '12.00' },
          { bodyTypeId: SUV, listPrice: '17.00', price: '15.00' },
        ],
        outOfStock: [],
      },
    ]);
  });

  it('para un lavado dice si cada combo vale hoy', async () => {
    const { usecases, live, weekend, paused } = await seeded();

    const found = await usecases.findForTickets([live.id, weekend.id, paused.id, 'nope']);

    expect(found.map((row) => [row.combo.name, row.availableToday])).toEqual([
      ['A vigente', true],
      ['B finde', false],
      ['E pausado', false],
    ]);
  });
});
