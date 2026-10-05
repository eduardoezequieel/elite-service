import { createComboSchema, combosQuerySchema, updateComboSchema } from './schemas';

const SERVICE_A = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a01';
const SERVICE_B = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a02';
const PRODUCT_A = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a03';
const BODY_SEDAN = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a04';
const BODY_SUV = '0b0e4c1e-1a3f-4b6a-9f1e-1c2d3e4f5a05';

const fixedCombo = {
  name: '  Combo verano ',
  items: [{ serviceId: SERVICE_A }, { inventoryItemId: PRODUCT_A, quantity: 2 }],
  pricingMode: 'FIXED',
  prices: [
    { bodyTypeId: BODY_SEDAN, price: 12 },
    { bodyTypeId: BODY_SUV, price: '15.5' },
  ],
  validFrom: '2026-10-01',
  validTo: '2026-12-31',
  weekdays: [6, 0],
};

function issuePaths(input: unknown, schema = createComboSchema): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('createComboSchema (104)', () => {
  it('acepta un combo fijo, normaliza nombre y precios y nace activo', () => {
    const parsed = createComboSchema.parse(fixedCombo);

    expect(parsed).toMatchObject({
      name: 'Combo verano',
      pricingMode: 'FIXED',
      prices: [
        { bodyTypeId: BODY_SEDAN, price: '12.00' },
        { bodyTypeId: BODY_SUV, price: '15.50' },
      ],
      isActive: true,
    });
  });

  it('acepta un combo con descuento, sin precios y sin fin', () => {
    const parsed = createComboSchema.parse({
      ...fixedCombo,
      pricingMode: 'PERCENT',
      discountPercent: 15,
      prices: undefined,
      validTo: null,
    });

    expect(parsed.prices).toEqual([]);
    expect(parsed.validTo).toBeNull();
  });

  it('pide al menos dos cosas (RN-1)', () => {
    expect(issuePaths({ ...fixedCombo, items: [{ serviceId: SERVICE_A }] })).toContain('items');
  });

  it('pide al menos un servicio (RN-1)', () => {
    expect(
      issuePaths({
        ...fixedCombo,
        items: [
          { inventoryItemId: PRODUCT_A, quantity: 1 },
          { inventoryItemId: SERVICE_B, quantity: 1 },
        ],
      }),
    ).toContain('items');
  });

  it('rechaza un servicio o producto repetido (RN-1)', () => {
    expect(
      issuePaths({
        ...fixedCombo,
        items: [{ serviceId: SERVICE_A }, { serviceId: SERVICE_B }, { serviceId: SERVICE_A }],
      }),
    ).toEqual(['items.2']);
    expect(
      issuePaths({
        ...fixedCombo,
        items: [
          { serviceId: SERVICE_A },
          { inventoryItemId: PRODUCT_A, quantity: 1 },
          { inventoryItemId: PRODUCT_A, quantity: 3 },
        ],
      }),
    ).toEqual(['items.2']);
  });

  it.each([0, 11, 1.5])('rechaza la cantidad de producto %p (RN-1)', (quantity) => {
    expect(
      issuePaths({
        ...fixedCombo,
        items: [{ serviceId: SERVICE_A }, { inventoryItemId: PRODUCT_A, quantity }],
      }),
    ).not.toEqual([]);
  });

  it('el descuento va solo en PERCENT y es obligatorio ahí (RN-2)', () => {
    expect(issuePaths({ ...fixedCombo, discountPercent: 10 })).toEqual(['discountPercent']);
    expect(issuePaths({ ...fixedCombo, pricingMode: 'PERCENT', prices: [] })).toEqual([
      'discountPercent',
    ]);
    expect(issuePaths({ ...fixedCombo, discountPercent: null })).toEqual([]);
  });

  it.each([0, 91, 12.5])('rechaza el descuento %p (RN-2)', (discountPercent) => {
    expect(issuePaths({ ...fixedCombo, pricingMode: 'PERCENT', discountPercent })).toContain(
      'discountPercent',
    );
  });

  it('rechaza un precio en cero y un tipo de carro repetido (RN-2)', () => {
    expect(
      issuePaths({
        ...fixedCombo,
        prices: [
          { bodyTypeId: BODY_SEDAN, price: '0' },
          { bodyTypeId: BODY_SEDAN, price: '10' },
        ],
      }),
    ).toEqual(['prices.0.price', 'prices.1.bodyTypeId']);
  });

  it('validTo no puede ser antes de validFrom (RN-3)', () => {
    expect(issuePaths({ ...fixedCombo, validTo: '2026-09-30' })).toEqual(['validTo']);
    expect(issuePaths({ ...fixedCombo, validTo: '2026-10-01' })).toEqual([]);
  });

  it('rechaza una fecha que no existe o con otro formato', () => {
    expect(issuePaths({ ...fixedCombo, validFrom: '2026-02-31' })).toContain('validFrom');
    expect(issuePaths({ ...fixedCombo, validFrom: '01/10/2026' })).toContain('validFrom');
  });

  it('los días no pueden faltar, repetirse ni salir de 0..6 (RN-3)', () => {
    expect(issuePaths({ ...fixedCombo, weekdays: [] })).toEqual(['weekdays']);
    expect(issuePaths({ ...fixedCombo, weekdays: [1, 1] })).toEqual(['weekdays']);
    expect(issuePaths({ ...fixedCombo, weekdays: [7] })).toEqual(['weekdays.0']);
  });

  it('el nombre no puede ir vacío ni pasar de 40', () => {
    expect(issuePaths({ ...fixedCombo, name: '   ' })).toEqual(['name']);
    expect(issuePaths({ ...fixedCombo, name: 'x'.repeat(41) })).toEqual(['name']);
  });
});

describe('updateComboSchema (104)', () => {
  it('acepta un cuerpo vacío y no inventa defaults', () => {
    expect(updateComboSchema.parse({})).toEqual({});
  });

  it('revisa las mismas reglas con lo que llega', () => {
    expect(issuePaths({ items: [{ serviceId: SERVICE_A }] }, updateComboSchema)).toEqual(['items']);
    expect(issuePaths({ pricingMode: 'PERCENT' }, updateComboSchema)).toEqual(['discountPercent']);
    expect(
      issuePaths({ validFrom: '2026-10-05', validTo: '2026-10-04' }, updateComboSchema),
    ).toEqual(['validTo']);
  });

  it('validTo en null quita la fecha de fin', () => {
    expect(updateComboSchema.parse({ validTo: null })).toEqual({ validTo: null });
  });
});

describe('combosQuerySchema (104)', () => {
  it('pagina por defecto y acepta el filtro de estado', () => {
    expect(combosQuerySchema.parse({ status: 'LIVE', search: ' verano ' })).toMatchObject({
      status: 'LIVE',
      search: 'verano',
      page: 1,
    });
    expect(combosQuerySchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });
});
